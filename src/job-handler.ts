/**
 * job-handler.ts
 *
 * Merged job handler for Spraay ACP Provider v2.
 *
 * Primary mode:  Claude reasoning engine (interprets NL, picks tools, chains calls)
 * Fallback mode: Keyword routing (original v1 logic, used if Claude is unavailable)
 *
 * The handler is called by ACP SDK callbacks (onNewTask) or polling loop.
 */

import { SpraayGatewayClient, type GatewayResponse } from "./gateway-client.js";
import { OFFERING_MAP, LIVE_OFFERINGS, type JobOffering } from "./offerings.js";
import { ClaudeReasoningEngine, type ReasoningResult } from "./claude-engine.js";

// ---------- Types ----------

/**
 * Flexible AcpJob interface — works across SDK versions.
 * The actual SDK type has `id: number`, but polling may return different shapes.
 * We keep this resilient.
 */
export interface AcpJob {
  id: string | number;
  // Job metadata
  name?: string;
  serviceRequirement?: string;
  requirement?: Record<string, any> | string;
  offeringId?: string;
  offeringName?: string;
  params?: Record<string, any>;
  clientAddress?: string;
  price?: number;
  phase?: number;
  // SDK lifecycle methods
  accept: (reason: string) => Promise<any>;
  reject: (reason: string) => Promise<any>;
  createRequirement: (requirement: string) => Promise<any>;
  deliver: (deliverable: string | Record<string, unknown>) => Promise<any>;
  evaluate?: (accept: boolean, reasoning: string) => Promise<void>;
  payAndAcceptRequirement?: () => Promise<any>;
}

export interface JobResult {
  success: boolean;
  offeringId: string;
  offeringName: string;
  gatewayResponse?: GatewayResponse;
  claudeResult?: ReasoningResult;
  error?: string;
  executionTimeMs: number;
  mode: "claude" | "keyword";
}

// ---------- Keyword routing (v1 fallback) ----------

const KEYWORD_MAP: Record<string, string> = {
  payroll: "spraay_batch_payroll",
  batch: "spraay_batch_payroll",
  "batch payment": "spraay_batch_payroll",
  swap: "spraay_token_swap",
  "token swap": "spraay_token_swap",
  exchange: "spraay_token_swap",
  invoice: "spraay_create_invoice",
  bill: "spraay_create_invoice",
  price: "spraay_price_feed",
  "price feed": "spraay_price_feed",
  oracle: "spraay_price_feed",
  "token price": "spraay_price_feed",
  inference: "spraay_ai_inference",
  ai: "spraay_ai_inference",
  chat: "spraay_ai_inference",
  llm: "spraay_ai_inference",
  bridge: "spraay_bridge_tokens",
  "cross-chain": "spraay_bridge_tokens",
  escrow: "spraay_create_escrow",
  milestone: "spraay_create_escrow",
  search: "spraay_web_search",
  "web search": "spraay_web_search",
  analytics: "spraay_wallet_analytics",
  portfolio: "spraay_wallet_analytics",
  "risk score": "spraay_wallet_analytics",
  email: "spraay_send_email",
  notify: "spraay_send_email",
  gpu: "spraay_gpu_run",
  "image gen": "spraay_gpu_run",
  replicate: "spraay_gpu_run",
  rpc: "spraay_rpc_call",
  "block number": "spraay_rpc_call",
  extract: "spraay_content_extract",
  rag: "spraay_content_extract",
  qna: "spraay_qna",
  "q&a": "spraay_qna",
  question: "spraay_qna",
};

// ---------- Handler ----------

export class JobHandler {
  private gateway: SpraayGatewayClient;
  private claudeEngine: ClaudeReasoningEngine | null = null;
  private useClaudeReasoning: boolean;
  private stats = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    totalRevenue: 0,
    totalGatewayCost: 0,
    claudeJobs: 0,
    keywordJobs: 0,
  };

  constructor(gateway: SpraayGatewayClient, options?: { useClaude?: boolean }) {
    this.gateway = gateway;
    this.useClaudeReasoning = options?.useClaude ?? (process.env.USE_CLAUDE_REASONING !== "false");

    if (this.useClaudeReasoning && process.env.ANTHROPIC_API_KEY) {
      try {
        this.claudeEngine = new ClaudeReasoningEngine(gateway);
        console.log("[handler] Claude reasoning engine: ENABLED");
      } catch (err: any) {
        console.warn(`[handler] Claude init failed: ${err.message} — falling back to keyword routing`);
        this.claudeEngine = null;
      }
    } else {
      console.log("[handler] Claude reasoning: DISABLED (keyword routing mode)");
    }
  }

  /**
   * Main job handler — entry point for ACP jobs.
   */
  async handleJob(job: AcpJob): Promise<JobResult> {
    const start = Date.now();
    this.stats.totalJobs++;

    const jobDesc = this.extractJobDescription(job);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[job] 💧 ACP Job: ${job.id}`);
    console.log(`[job] Request: ${jobDesc.slice(0, 150)}${jobDesc.length > 150 ? "..." : ""}`);

    // Try Claude first, fall back to keyword routing
    if (this.claudeEngine) {
      try {
        return await this.handleWithClaude(job, jobDesc, start);
      } catch (err: any) {
        console.warn(`[job] Claude failed, falling back to keywords: ${err.message}`);
      }
    }

    return await this.handleWithKeywords(job, jobDesc, start);
  }

  // ─── Claude Reasoning Path ──────────────────────────────────

  private async handleWithClaude(job: AcpJob, jobDesc: string, start: number): Promise<JobResult> {
    console.log(`[job] 🧠 Using Claude reasoning...`);
    this.stats.claudeJobs++;

    // Accept the job
    try {
      await job.accept("Spraay Agent processing your request with AI reasoning. Stand by.");
      console.log("[job] ✓ Accepted");
    } catch (e: any) {
      console.warn(`[job] accept() error: ${e.message?.slice(0, 80)}`);
    }

    // Build context
    const context = [
      job.clientAddress ? `Buyer address: ${job.clientAddress}` : "",
      job.price ? `Job price: $${job.price} USDC` : "",
      job.name ? `Service: ${job.name}` : "",
    ].filter(Boolean).join("\n");

    // Process through Claude
    const result = await this.claudeEngine!.processJob(jobDesc, context || undefined);

    console.log(`[job] 🧠 Claude: success=${result.success}, tools=${result.toolCallCount}, cost=$${result.totalGatewayCost.toFixed(4)}`);
    console.log(`[job] Offerings used: ${result.offeringsUsed.join(", ") || "none"}`);

    // Build deliverable
    const deliverable = JSON.stringify({
      agent: "Spraay ACP Provider v2.0 (Claude-powered)",
      jobId: String(job.id),
      status: result.success ? "completed" : "failed",
      summary: result.summary,
      services_used: result.offeringsUsed,
      metrics: {
        tool_calls: result.toolCallCount,
        gateway_cost_usdc: result.totalGatewayCost.toFixed(4),
        execution_time_ms: Date.now() - start,
      },
      results: result.results.map((r) => ({
        endpoint: r.endpoint,
        success: r.success,
        data: r.data,
        error: r.error,
        latency_ms: r.latencyMs,
      })),
      powered_by: "Spraay x402 Gateway + Claude AI",
      ...(result.error ? { error: result.error } : {}),
    });

    // Deliver
    try {
      await job.deliver(deliverable);
      console.log("[job] ✓ Delivered to buyer");
    } catch (e: any) {
      console.error(`[job] deliver() failed: ${e.message}`);
    }

    // Update stats
    if (result.success) {
      this.stats.successfulJobs++;
      // Revenue = sum of ACP prices for offerings used
      for (const id of result.offeringsUsed) {
        const offering = OFFERING_MAP.get(id);
        if (offering) this.stats.totalRevenue += parseFloat(offering.acpPrice);
      }
      this.stats.totalGatewayCost += result.totalGatewayCost;
    } else {
      this.stats.failedJobs++;
    }

    console.log(`${"=".repeat(60)}\n`);
    this.printStats();

    return {
      success: result.success,
      offeringId: result.offeringsUsed[0] || "multi",
      offeringName: result.offeringsUsed.map((id) => OFFERING_MAP.get(id)?.name || id).join(" + "),
      claudeResult: result,
      executionTimeMs: Date.now() - start,
      mode: "claude",
    };
  }

  // ─── Keyword Routing Path (v1 fallback) ─────────────────────

  private async handleWithKeywords(job: AcpJob, jobDesc: string, start: number): Promise<JobResult> {
    console.log(`[job] 📋 Using keyword routing (fallback)...`);
    this.stats.keywordJobs++;

    const offering = this.resolveByKeywords(jobDesc, job.offeringId);
    if (!offering) {
      const availableServices = LIVE_OFFERINGS.map((o) => o.name).join(", ");
      const rejectMsg = `Could not match your request to a service. Available: ${availableServices}`;
      console.log(`[job] ✗ No matching offering`);
      try { await job.reject(rejectMsg); } catch {}
      this.stats.failedJobs++;
      return { success: false, offeringId: "unknown", offeringName: "Unknown", error: "No match", executionTimeMs: Date.now() - start, mode: "keyword" };
    }

    console.log(`[job] ✓ Matched: ${offering.name} (ACP: $${offering.acpPrice})`);

    try {
      await job.accept(`Processing "${offering.name}" via Spraay x402 gateway.`);
    } catch {}

    const params = this.extractParams(job, jobDesc);
    const result = await this.gateway.executeByOffering(offering.id, params);

    if (result.success) {
      const deliverable = JSON.stringify({
        agent: "Spraay ACP Provider v2.0 (keyword mode)",
        service: offering.name,
        status: "completed",
        result: result.data,
        execution_time_ms: result.latencyMs,
        gateway_cost_usdc: result.gatewayCost,
        powered_by: "Spraay x402 Gateway",
      });
      try { await job.deliver(deliverable); console.log("[job] ✓ Delivered"); } catch {}
      this.stats.successfulJobs++;
      this.stats.totalRevenue += parseFloat(offering.acpPrice);
      this.stats.totalGatewayCost += parseFloat(offering.gatewayCost);
    } else {
      const errorDeliverable = JSON.stringify({
        service: offering.name,
        status: "failed",
        error: result.error,
        powered_by: "Spraay x402 Gateway",
      });
      try { await job.deliver(errorDeliverable); } catch {}
      this.stats.failedJobs++;
    }

    console.log(`${"=".repeat(60)}\n`);
    this.printStats();

    return {
      success: result.success,
      offeringId: offering.id,
      offeringName: offering.name,
      gatewayResponse: result,
      executionTimeMs: Date.now() - start,
      mode: "keyword",
    };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private extractJobDescription(job: AcpJob): string {
    // Try all possible locations for the job request text
    if (job.serviceRequirement) return job.serviceRequirement;
    if (typeof job.requirement === "string") return job.requirement;
    if (job.requirement && typeof job.requirement === "object") return JSON.stringify(job.requirement);
    if (job.name) return job.name;
    return "(empty request)";
  }

  private resolveByKeywords(text: string, directOfferingId?: string): JobOffering | null {
    if (directOfferingId && OFFERING_MAP.has(directOfferingId)) {
      return OFFERING_MAP.get(directOfferingId)!;
    }
    const req = text.toLowerCase();
    for (const [keyword, offeringId] of Object.entries(KEYWORD_MAP)) {
      if (req.includes(keyword)) {
        return OFFERING_MAP.get(offeringId) || null;
      }
    }
    // Fuzzy
    let best: JobOffering | null = null;
    let bestScore = 0;
    for (const offering of LIVE_OFFERINGS) {
      let score = 0;
      const words = req.split(/\s+/);
      for (const w of words) {
        if (offering.name.toLowerCase().includes(w)) score += 5;
        if (offering.description.toLowerCase().includes(w)) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = offering; }
    }
    return bestScore >= 5 ? best : null;
  }

  private extractParams(job: AcpJob, jobDesc: string): Record<string, any> {
    if (job.params && Object.keys(job.params).length > 0) return job.params;
    try {
      const jsonMatch = jobDesc.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return { raw_request: jobDesc };
  }

  // ─── Stats ──────────────────────────────────────────────────

  printStats() {
    const margin = this.stats.totalRevenue - this.stats.totalGatewayCost;
    console.log(
      `[stats] Jobs: ${this.stats.totalJobs} | ✓ ${this.stats.successfulJobs} | ✗ ${this.stats.failedJobs} | ` +
      `Claude: ${this.stats.claudeJobs} | Keyword: ${this.stats.keywordJobs} | ` +
      `Rev: $${this.stats.totalRevenue.toFixed(2)} | Cost: $${this.stats.totalGatewayCost.toFixed(3)} | Margin: $${margin.toFixed(2)}`
    );
  }

  getStats() { return { ...this.stats }; }
}
