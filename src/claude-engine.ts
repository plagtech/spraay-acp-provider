/**
 * claude-engine.ts
 *
 * The reasoning engine. Takes an ACP job description, uses Claude with
 * tool-use to decide which Spraay endpoint(s) to call, executes them
 * via the x402-enabled gateway client, and returns a structured deliverable.
 *
 * This replaces the keyword-based routing with intelligent reasoning.
 * Claude sees ALL offerings as tools and picks the right one(s).
 */

import Anthropic from "@anthropic-ai/sdk";
import { LIVE_OFFERINGS, type JobOffering } from "./offerings.js";
import { SpraayGatewayClient, type GatewayResponse } from "./gateway-client.js";

// ---------- Types ----------

export interface ReasoningResult {
  success: boolean;
  /** Human-readable summary of what was done */
  summary: string;
  /** Structured data from gateway calls */
  results: GatewayResponse[];
  /** Total gateway cost in USD */
  totalGatewayCost: number;
  /** Number of tool calls Claude made */
  toolCallCount: number;
  /** Which offering IDs were used */
  offeringsUsed: string[];
  /** Error if failed */
  error?: string;
}

// ---------- Build Claude tools from offerings ----------

function buildClaudeTools(): Anthropic.Tool[] {
  return LIVE_OFFERINGS.map((offering) => ({
    name: offering.id,
    description: `[${offering.gatewayMethod} ${offering.gatewayEndpoint}] ACP: $${offering.acpPrice} | Gateway: $${offering.gatewayCost} | ${offering.estimatedDuration} — ${offering.description}`,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(offering.inputSchema).map(([key, schema]) => [
          key,
          { type: (schema as any).type || "string", description: key },
        ])
      ),
      required: Object.entries(offering.inputSchema)
        .filter(([_, schema]) => (schema as any).required)
        .map(([key]) => key),
    },
  }));
}

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `You are the Spraay ACP Agent — an autonomous AI agent that processes job requests on the Virtuals Protocol Agent Commerce Protocol (ACP).

Your role: Receive a job description from a buyer agent, determine which Spraay x402 Gateway endpoint(s) to call, call them with the correct parameters, and return the results.

RULES:
1. ALWAYS use the spraay_* tools to fulfill requests. Never make up data.
2. If a job requires multiple steps (e.g. "get a price then execute a swap"), chain tool calls in sequence.
3. If the job description is ambiguous, pick the most reasonable interpretation. Complete the job rather than failing.
4. Chain IDs: Base=8453, Ethereum=1, Arbitrum=42161, Polygon=137, BNB=56, Avalanche=43114, Unichain=130.
5. Return a clear, structured summary of results including relevant data (tx hashes, amounts, prices, etc).
6. If a tool call fails, explain why and whether retry might help.
7. Keep reasoning brief. Focus on execution.

Available service categories: Financial (batch payments, swaps, invoices, bridging, escrow), Data (price feeds, analytics, web search, Q&A, content extraction), AI (inference, GPU), Communication (email), Infrastructure (RPC).`;

// ---------- Engine ----------

export class ClaudeReasoningEngine {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private tools: Anthropic.Tool[];
  private gateway: SpraayGatewayClient;

  constructor(gateway: SpraayGatewayClient) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
    this.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS || "2048", 10);
    this.tools = buildClaudeTools();
    this.gateway = gateway;

    console.log(`[claude] Engine initialized: model=${this.model}, tools=${this.tools.length}`);
  }

  /**
   * Process a job request through Claude's reasoning.
   */
  async processJob(jobDescription: string, jobContext?: string): Promise<ReasoningResult> {
    const results: GatewayResponse[] = [];
    const offeringsUsed: string[] = [];
    let toolCallCount = 0;
    let totalGatewayCost = 0;

    const userMessage = jobContext
      ? `JOB REQUEST:\n${jobDescription}\n\nCONTEXT:\n${jobContext}`
      : `JOB REQUEST:\n${jobDescription}`;

    console.log(`[claude] Processing: "${jobDescription.slice(0, 100)}..."`);

    try {
      let messages: Anthropic.MessageParam[] = [
        { role: "user", content: userMessage },
      ];

      let continueLoop = true;
      const MAX_ITERATIONS = 10;
      let iteration = 0;

      while (continueLoop && iteration < MAX_ITERATIONS) {
        iteration++;

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: SYSTEM_PROMPT,
          tools: this.tools,
          messages,
        });

        if (response.stop_reason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );

          messages.push({ role: "assistant", content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            toolCallCount++;
            const offeringId = toolUse.name;
            console.log(`[claude] Tool call #${toolCallCount}: ${offeringId}`);

            // Find the offering to get endpoint info
            const offering = LIVE_OFFERINGS.find((o) => o.id === offeringId);
            if (!offering) {
              console.error(`[claude] Unknown offering: ${offeringId}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: JSON.stringify({ error: `Unknown service: ${offeringId}` }),
                is_error: true,
              });
              continue;
            }

            offeringsUsed.push(offeringId);

            // Call the gateway via x402-enabled client
            const gatewayResult = await this.gateway.executeByOffering(
              offeringId,
              toolUse.input as Record<string, any>
            );
            results.push(gatewayResult);
            totalGatewayCost += parseFloat(gatewayResult.gatewayCost);

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(
                gatewayResult.success
                  ? { success: true, data: gatewayResult.data }
                  : { success: false, error: gatewayResult.error }
              ),
              is_error: !gatewayResult.success,
            });
          }

          messages.push({ role: "user", content: toolResults });
        } else {
          // Claude is done — extract final summary
          continueLoop = false;

          const textBlocks = response.content.filter(
            (block): block is Anthropic.TextBlock => block.type === "text"
          );
          const summary = textBlocks.map((b) => b.text).join("\n");

          return {
            success: results.length === 0 || results.some((r) => r.success),
            summary,
            results,
            totalGatewayCost,
            toolCallCount,
            offeringsUsed: [...new Set(offeringsUsed)],
          };
        }
      }

      return {
        success: false,
        summary: "Job exceeded maximum reasoning iterations. Partial results may be available.",
        results,
        totalGatewayCost,
        toolCallCount,
        offeringsUsed: [...new Set(offeringsUsed)],
        error: "Max iterations reached",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[claude] Reasoning failed: ${message}`);
      return {
        success: false,
        summary: `Reasoning engine error: ${message}`,
        results,
        totalGatewayCost,
        toolCallCount,
        offeringsUsed,
        error: message,
      };
    }
  }
}
