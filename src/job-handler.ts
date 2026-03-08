import { SpraayGatewayClient, GatewayResponse } from "./gateway-client.js";
import { OFFERING_MAP, LIVE_OFFERINGS, JobOffering } from "./offerings.js";

/**
 * AcpJob shape from @virtuals-protocol/acp-node SDK.
 * We keep our own interface to stay resilient if the SDK's types shift.
 * The SDK provides these methods on the job object passed to onNewTask.
 */
export interface AcpJob {
  id: string;
  // The SDK passes the buyer's requirement text here
  serviceRequirement?: string;
  // Some SDK versions include offering info
  offeringId?: string;
  offeringName?: string;
  // Extra structured data (may or may not be present)
  params?: Record<string, any>;
  // SDK-provided lifecycle methods
  accept: (reason: string) => Promise<void>;
  reject: (reason: string) => Promise<void>;
  createRequirement: (requirement: string) => Promise<void>;
  deliver: (deliverable: string) => Promise<void>;
  // These may exist on newer SDK versions
  evaluate?: (accept: boolean, reasoning: string) => Promise<void>;
  payAndAcceptRequirement?: () => Promise<void>;
}

export interface JobResult {
  success: boolean;
  offeringId: string;
  offeringName: string;
  gatewayResponse?: GatewayResponse;
  error?: string;
  executionTimeMs: number;
}

// Keywords mapped to offering IDs for fuzzy matching
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

export class JobHandler {
  private gateway: SpraayGatewayClient;
  private stats = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    totalRevenue: 0,
    totalGatewayCost: 0,
  };

  constructor(gateway: SpraayGatewayClient) {
    this.gateway = gateway;
  }

  /**
   * Resolve which offering to use based on the job's requirement text.
   * Priority: exact offeringId > keyword match > best fuzzy score
   */
  private resolveOffering(job: AcpJob): JobOffering | null {
    // 1) Direct offering ID match
    if (job.offeringId && OFFERING_MAP.has(job.offeringId)) {
      return OFFERING_MAP.get(job.offeringId)!;
    }

    const req = (job.serviceRequirement || "").toLowerCase();
    if (!req) return null;

    // 2) Keyword map — first match wins
    for (const [keyword, offeringId] of Object.entries(KEYWORD_MAP)) {
      if (req.includes(keyword)) {
        const offering = OFFERING_MAP.get(offeringId);
        if (offering) return offering;
      }
    }

    // 3) Fuzzy match against offering names/descriptions
    let bestMatch: JobOffering | null = null;
    let bestScore = 0;
    for (const offering of LIVE_OFFERINGS) {
      let score = 0;
      const words = req.split(/\s+/);
      const nameWords = offering.name.toLowerCase().split(/\s+/);
      const descWords = offering.description.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (nameWords.some((nw) => nw.includes(w) || w.includes(nw))) score += 5;
        if (descWords.some((dw) => dw.includes(w) || w.includes(dw))) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = offering;
      }
    }
    return bestScore >= 5 ? bestMatch : null;
  }

  /**
   * Extract structured params from the job.
   * Tries: job.params → JSON block in serviceRequirement → raw text
   */
  private extractParams(job: AcpJob, _offering: JobOffering): Record<string, any> {
    // Already structured
    if (job.params && typeof job.params === "object" && Object.keys(job.params).length > 0) {
      return job.params;
    }

    // Try to extract JSON from the requirement text
    const req = job.serviceRequirement || "";
    try {
      const jsonMatch = req.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
      // not valid JSON, fall through
    }

    // Return raw request text as the primary param
    return { raw_request: req };
  }

  /**
   * Main job handler — called by ACP SDK's onNewTask callback.
   */
  async handleJob(job: AcpJob): Promise<JobResult> {
    const start = Date.now();
    this.stats.totalJobs++;

    console.log(`\n${"=".repeat(50)}`);
    console.log(`[job] New ACP Job: ${job.id}`);
    console.log(`[job] Requirement: ${job.serviceRequirement || "(empty)"}`);
    if (job.offeringId) console.log(`[job] Offering ID: ${job.offeringId}`);

    // Step 1: Resolve which offering this maps to
    const offering = this.resolveOffering(job);
    if (!offering) {
      const availableServices = LIVE_OFFERINGS.map((o) => o.name).join(", ");
      const rejectMsg = `Could not match your request to a service. Available: ${availableServices}`;
      console.log(`[job] ✗ No matching offering found`);
      try {
        await job.reject(rejectMsg);
      } catch (e: any) {
        console.error(`[job] reject() failed: ${e.message}`);
      }
      this.stats.failedJobs++;
      return {
        success: false,
        offeringId: "unknown",
        offeringName: "Unknown",
        error: "No matching offering",
        executionTimeMs: Date.now() - start,
      };
    }

    console.log(`[job] ✓ Matched: ${offering.name} (ACP: $${offering.acpPrice}, Gateway: $${offering.gatewayCost})`);

    // Step 2: Accept the job
    try {
      await job.accept(`Processing "${offering.name}" via Spraay x402 gateway.`);
      console.log(`[job] Accepted`);
    } catch (e: any) {
      console.error(`[job] accept() failed: ${e.message}`);
      // Continue anyway — some SDK versions don't require explicit accept
    }

    // Step 3: Extract params and call gateway
    const params = this.extractParams(job, offering);
    console.log(`[job] Params:`, JSON.stringify(params).slice(0, 200));
    console.log(`[job] Calling gateway...`);

    const result = await this.gateway.executeJob(offering.id, params);

    // Step 4: Deliver result
    if (result.success) {
      console.log(`[job] ✓ Gateway OK (${result.latencyMs}ms)`);
      const deliverable = JSON.stringify({
        service: offering.name,
        status: "completed",
        result: result.data,
        execution_time_ms: result.latencyMs,
        gateway_cost_usdc: result.gatewayCost,
        powered_by: "Spraay x402 Gateway",
        docs: "https://docs.spraay.app",
      });

      try {
        await job.deliver(deliverable);
        console.log(`[job] ✓ Delivered to buyer`);
      } catch (e: any) {
        console.error(`[job] deliver() failed: ${e.message}`);
      }

      this.stats.successfulJobs++;
      this.stats.totalRevenue += parseFloat(offering.acpPrice);
      this.stats.totalGatewayCost += parseFloat(offering.gatewayCost);
    } else {
      console.log(`[job] ✗ Gateway failed: ${result.error}`);
      const errorDeliverable = JSON.stringify({
        service: offering.name,
        status: "failed",
        error: result.error,
        powered_by: "Spraay x402 Gateway",
      });

      try {
        await job.deliver(errorDeliverable);
      } catch (e: any) {
        console.error(`[job] deliver(error) failed: ${e.message}`);
      }

      this.stats.failedJobs++;
    }

    console.log(`${"=".repeat(50)}\n`);
    this.printStats();

    return {
      success: result.success,
      offeringId: offering.id,
      offeringName: offering.name,
      gatewayResponse: result,
      executionTimeMs: Date.now() - start,
    };
  }

  printStats() {
    const margin = this.stats.totalRevenue - this.stats.totalGatewayCost;
    console.log(
      `[stats] Jobs: ${this.stats.totalJobs} | ✓ ${this.stats.successfulJobs} | ✗ ${this.stats.failedJobs} | Rev: $${this.stats.totalRevenue.toFixed(2)} | Cost: $${this.stats.totalGatewayCost.toFixed(3)} | Margin: $${margin.toFixed(2)}`,
    );
  }

  getStats() {
    return { ...this.stats };
  }
}
