
# Run this from C:\Users\Hp\Documents\spraay-acp-provider

# === package.json ===
@'
{
  "name": "spraay-acp-provider",
  "version": "1.0.0",
  "description": "Spraay Agent - Full-stack crypto infrastructure provider on Virtuals ACP",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "npx tsx src/index.ts"
  },
  "dependencies": {
    "@virtuals-protocol/acp-node": "^0.1.0",
    "dotenv": "^16.4.0",
    "ethers": "^5.7.2"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
'@ | Out-File -Encoding utf8 package.json

# === tsconfig.json ===
@'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
'@ | Out-File -Encoding utf8 tsconfig.json

# === .env.example ===
@'
SELLER_AGENT_WALLET_ADDRESS=
SESSION_ENTITY_KEY_ID=
WHITELISTED_WALLET_PRIVATE_KEY=
CUSTOM_RPC_URL=
SPRAAY_GATEWAY_URL=https://gateway.spraay.app
X402_WALLET_PRIVATE_KEY=
BUYER_AGENT_WALLET_ADDRESS=
BUYER_WHITELISTED_WALLET_PRIVATE_KEY=
'@ | Out-File -Encoding utf8 .env.example

# === src/offerings.ts ===
@'
export interface JobOffering {
  id: string;
  name: string;
  description: string;
  tier: 1 | 2 | 3;
  acpPrice: string;
  gatewayEndpoint: string;
  gatewayMethod: "GET" | "POST";
  gatewayCost: string;
  category: string;
  estimatedDuration: string;
  inputSchema: Record<string, any>;
  outputDescription: string;
  sampleOutput?: Record<string, any>;
  live: boolean;
}

const batchPayroll: JobOffering = {
  id: "spraay_batch_payroll",
  name: "Batch Payroll",
  description: "Send USDC/ERC-20 payments to multiple wallets in a single transaction on Base.",
  tier: 1, acpPrice: "2.00", gatewayEndpoint: "/api/v1/payroll/run", gatewayMethod: "POST",
  gatewayCost: "0.01", category: "Financial", estimatedDuration: "30s",
  inputSchema: {
    name: { type: "string", required: true },
    token: { type: "string", required: true },
    employees: { type: "array", required: true }
  },
  outputDescription: "Transaction hash, payroll ID, per-recipient status",
  sampleOutput: { payroll_id: "pr_8f3a2b", tx: "0xabc...def", total_sent: "12500.00", recipients_count: 25, status: "confirmed" },
  live: true
};

const tokenSwap: JobOffering = {
  id: "spraay_token_swap",
  name: "Token Swap",
  description: "Best-route swap quotes and execution on Base via Uniswap V3 and Aerodrome.",
  tier: 1, acpPrice: "0.50", gatewayEndpoint: "/api/v1/swap/quote", gatewayMethod: "GET",
  gatewayCost: "0.005", category: "Financial", estimatedDuration: "5s",
  inputSchema: {
    from: { type: "string", required: true },
    to: { type: "string", required: true },
    amount: { type: "string", required: true },
    slippage: { type: "number", required: false }
  },
  outputDescription: "Swap quote with output amount, route, price impact",
  sampleOutput: { amountOut: "0.0351", route: "USDC>WETH", priceImpact: "0.02%", dex: "Uniswap V3" },
  live: true
};

const createInvoice: JobOffering = {
  id: "spraay_create_invoice",
  name: "Create Invoice",
  description: "Generate crypto invoices with on-chain payment tracking.",
  tier: 1, acpPrice: "0.50", gatewayEndpoint: "/api/v1/invoice/create", gatewayMethod: "POST",
  gatewayCost: "0.005", category: "Financial", estimatedDuration: "3s",
  inputSchema: {
    to: { type: "string", required: true },
    items: { type: "array", required: true },
    token: { type: "string", required: false },
    due_date: { type: "string", required: false }
  },
  outputDescription: "Invoice ID, payment link, status",
  sampleOutput: { invoice_id: "inv_x9f2", pay_link: "https://spraay.app/pay/inv_x9f2", status: "pending", total: "2500.00" },
  live: true
};

const priceFeed: JobOffering = {
  id: "spraay_price_feed",
  name: "Price Feed Oracle",
  description: "Real-time token prices, gas estimates, and FX rates.",
  tier: 1, acpPrice: "0.10", gatewayEndpoint: "/api/v1/prices", gatewayMethod: "GET",
  gatewayCost: "0.002", category: "Data", estimatedDuration: "1s",
  inputSchema: {
    tokens: { type: "string", required: false },
    include_gas: { type: "boolean", required: false }
  },
  outputDescription: "Token prices in USD with 24h change",
  sampleOutput: { ETH: { usd: 2847.5, change_24h: 1.2 }, USDC: { usd: 1.0 }, gas: { base: "0.004 gwei" } },
  live: true
};

const aiInference: JobOffering = {
  id: "spraay_ai_inference",
  name: "AI Inference",
  description: "Pay-per-call access to 200+ LLM models via OpenRouter.",
  tier: 1, acpPrice: "0.25", gatewayEndpoint: "/api/v1/ai/chat", gatewayMethod: "POST",
  gatewayCost: "0.01", category: "AI", estimatedDuration: "5-15s",
  inputSchema: {
    model: { type: "string", required: true },
    messages: { type: "array", required: true },
    max_tokens: { type: "number", required: false }
  },
  outputDescription: "Model response text, token usage",
  live: true
};

const bridgeTokens: JobOffering = {
  id: "spraay_bridge_tokens",
  name: "Bridge Tokens",
  description: "Cross-chain token transfers across 11 chains.",
  tier: 2, acpPrice: "1.50", gatewayEndpoint: "/api/v1/bridge/transfer", gatewayMethod: "POST",
  gatewayCost: "0.02", category: "Financial", estimatedDuration: "1-5 min",
  inputSchema: {
    from_chain: { type: "string", required: true },
    to_chain: { type: "string", required: true },
    token: { type: "string", required: true },
    amount: { type: "string", required: true }
  },
  outputDescription: "Bridge ID, tx hash, ETA",
  live: true
};

const createEscrow: JobOffering = {
  id: "spraay_create_escrow",
  name: "Create Escrow",
  description: "Conditional payment escrows with milestone or time-lock release.",
  tier: 2, acpPrice: "1.50", gatewayEndpoint: "/api/v1/escrow/create", gatewayMethod: "POST",
  gatewayCost: "0.02", category: "Financial", estimatedDuration: "10s",
  inputSchema: {
    token: { type: "string", required: true },
    amount: { type: "string", required: true },
    recipient: { type: "string", required: true },
    conditions: { type: "object", required: true }
  },
  outputDescription: "Escrow ID, tx hash, release conditions",
  live: true
};

const webSearch: JobOffering = {
  id: "spraay_web_search",
  name: "Web Search",
  description: "Clean LLM-ready web search results via Tavily.",
  tier: 2, acpPrice: "0.25", gatewayEndpoint: "/api/v1/search/web", gatewayMethod: "POST",
  gatewayCost: "0.01", category: "Data", estimatedDuration: "3s",
  inputSchema: {
    query: { type: "string", required: true },
    search_depth: { type: "string", required: false },
    max_results: { type: "number", required: false }
  },
  outputDescription: "Synthesized answer plus search results",
  live: true
};

const walletAnalytics: JobOffering = {
  id: "spraay_wallet_analytics",
  name: "Wallet Analytics",
  description: "Portfolio value, risk scoring, transaction profiling.",
  tier: 2, acpPrice: "0.25", gatewayEndpoint: "/api/v1/analytics", gatewayMethod: "GET",
  gatewayCost: "0.005", category: "Data", estimatedDuration: "3s",
  inputSchema: {
    address: { type: "string", required: true },
    chain: { type: "string", required: false },
    depth: { type: "string", required: false }
  },
  outputDescription: "Portfolio value, risk score, tx count",
  live: true
};

const sendEmail: JobOffering = {
  id: "spraay_send_email",
  name: "Send Email",
  description: "Transactional emails via AgentMail.",
  tier: 3, acpPrice: "0.15", gatewayEndpoint: "/api/v1/notify/send", gatewayMethod: "POST",
  gatewayCost: "0.005", category: "Communication", estimatedDuration: "2s",
  inputSchema: {
    channel: { type: "string", required: true },
    to: { type: "string", required: true },
    subject: { type: "string", required: true },
    body: { type: "string", required: true }
  },
  outputDescription: "Send confirmation with message ID",
  live: true
};

const gpuRun: JobOffering = {
  id: "spraay_gpu_run",
  name: "GPU Model Run",
  description: "AI model inference via Replicate - image, video, LLM, audio.",
  tier: 3, acpPrice: "1.00", gatewayEndpoint: "/api/v1/gpu/run", gatewayMethod: "POST",
  gatewayCost: "0.05", category: "AI", estimatedDuration: "10-60s",
  inputSchema: {
    model: { type: "string", required: true },
    input: { type: "object", required: true }
  },
  outputDescription: "Prediction result with output URLs",
  live: true
};

const rpcCall: JobOffering = {
  id: "spraay_rpc_call",
  name: "RPC Call",
  description: "Premium multi-chain JSON-RPC via Alchemy. 7 chains.",
  tier: 3, acpPrice: "0.05", gatewayEndpoint: "/api/v1/rpc", gatewayMethod: "POST",
  gatewayCost: "0.001", category: "Infrastructure", estimatedDuration: "1s",
  inputSchema: {
    chain: { type: "string", required: true },
    method: { type: "string", required: true },
    params: { type: "array", required: true }
  },
  outputDescription: "JSON-RPC result",
  live: true
};

const contentExtract: JobOffering = {
  id: "spraay_content_extract",
  name: "Extract URL Content",
  description: "Clean content extraction from URLs for RAG pipelines.",
  tier: 3, acpPrice: "0.25", gatewayEndpoint: "/api/v1/search/extract", gatewayMethod: "POST",
  gatewayCost: "0.015", category: "Data", estimatedDuration: "5s",
  inputSchema: { urls: { type: "array", required: true } },
  outputDescription: "Array of extracted content",
  live: true
};

const qna: JobOffering = {
  id: "spraay_qna",
  name: "Q&A Search",
  description: "Natural language Q&A with cited sources.",
  tier: 3, acpPrice: "0.35", gatewayEndpoint: "/api/v1/search/qna", gatewayMethod: "POST",
  gatewayCost: "0.02", category: "Data", estimatedDuration: "5s",
  inputSchema: {
    query: { type: "string", required: true },
    topic: { type: "string", required: false }
  },
  outputDescription: "Synthesized answer with sources",
  live: true
};

export const JOB_OFFERINGS: JobOffering[] = [
  batchPayroll, tokenSwap, createInvoice, priceFeed, aiInference,
  bridgeTokens, createEscrow, webSearch, walletAnalytics,
  sendEmail, gpuRun, rpcCall, contentExtract, qna
];

export const LIVE_OFFERINGS = JOB_OFFERINGS.filter((j) => j.live);
export const OFFERING_MAP = new Map(JOB_OFFERINGS.map((j) => [j.id, j]));

export const AGENT_PROFILE = {
  name: "Spraay Agent",
  description: "Full-stack crypto infrastructure agent on Virtuals ACP. Batch payments, swaps, bridging, invoicing, AI inference, web search, and more via x402 gateway on Base.",
  website: "https://spraay.app",
  docs: "https://docs.spraay.app",
  github: "https://github.com/plagtech/spraay-acp-provider",
  twitter: "@Spraay_app",
  totalOfferings: JOB_OFFERINGS.length,
  liveOfferings: LIVE_OFFERINGS.length
};
'@ | Out-File -Encoding utf8 src/offerings.ts

# === src/gateway-client.ts ===
@'
import { OFFERING_MAP } from "./offerings.js";

export interface GatewayResponse {
  success: boolean;
  data?: any;
  error?: string;
  latencyMs: number;
  gatewayCost: string;
}

export class SpraayGatewayClient {
  private baseUrl: string;
  private walletPrivateKey: string;

  constructor(baseUrl: string, walletPrivateKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.walletPrivateKey = walletPrivateKey;
  }

  async executeJob(offeringId: string, params: Record<string, any>): Promise<GatewayResponse> {
    const offering = OFFERING_MAP.get(offeringId);
    if (!offering) {
      return { success: false, error: `Unknown offering: ${offeringId}`, latencyMs: 0, gatewayCost: "0" };
    }
    const start = Date.now();
    try {
      let url = `${this.baseUrl}${offering.gatewayEndpoint}`;
      let fetchOpts: RequestInit = { headers: { "Content-Type": "application/json" } };

      if (offering.gatewayMethod === "GET") {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) qs.set(k, String(v));
        }
        const qsStr = qs.toString();
        if (qsStr) url += `?${qsStr}`;
        fetchOpts.method = "GET";
      } else {
        fetchOpts.method = "POST";
        fetchOpts.body = JSON.stringify(params);
      }

      console.log(`[gateway] ${offering.gatewayMethod} ${url}`);
      const response = await fetch(url, fetchOpts);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return { success: false, error: `Gateway ${response.status}: ${errorText}`, latencyMs, gatewayCost: offering.gatewayCost };
      }
      const data = await response.json();
      return { success: true, data, latencyMs, gatewayCost: offering.gatewayCost };
    } catch (err: any) {
      return { success: false, error: `Gateway failed: ${err.message}`, latencyMs: Date.now() - start, gatewayCost: "0" };
    }
  }

  async healthCheck(): Promise<boolean> {
    try { const res = await fetch(`${this.baseUrl}/api/v1/prices`); return res.ok; }
    catch { return false; }
  }
}
'@ | Out-File -Encoding utf8 src/gateway-client.ts

# === src/job-handler.ts ===
@'
import { SpraayGatewayClient, GatewayResponse } from "./gateway-client.js";
import { OFFERING_MAP, LIVE_OFFERINGS, JobOffering } from "./offerings.js";

export interface AcpJob {
  id: string;
  offeringId?: string;
  serviceRequirement?: string;
  params?: Record<string, any>;
  accept: (reason: string) => Promise<void>;
  reject: (reason: string) => Promise<void>;
  createRequirement: (requirement: any) => Promise<void>;
  deliver: (deliverable: any) => Promise<void>;
}

export interface JobResult {
  success: boolean;
  offeringId: string;
  offeringName: string;
  gatewayResponse?: GatewayResponse;
  error?: string;
  executionTimeMs: number;
}

export class JobHandler {
  private gateway: SpraayGatewayClient;
  private stats = { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalRevenue: 0, totalGatewayCost: 0 };

  constructor(gateway: SpraayGatewayClient) { this.gateway = gateway; }

  private resolveOffering(job: AcpJob): JobOffering | null {
    if (job.offeringId && OFFERING_MAP.has(job.offeringId)) return OFFERING_MAP.get(job.offeringId)!;
    const req = (job.serviceRequirement || "").toLowerCase();
    let bestMatch: JobOffering | null = null;
    let bestScore = 0;
    for (const offering of LIVE_OFFERINGS) {
      let score = 0;
      const name = offering.name.toLowerCase();
      const id = offering.id.toLowerCase();
      if (req.includes(name)) score += 10;
      if (req.includes(id)) score += 10;
      const keywords: Record<string, string> = { payroll: "payroll", swap: "swap", bridge: "bridge", invoice: "invoice", price: "price", escrow: "escrow", search: "search", email: "email", gpu: "gpu", rpc: "rpc", ipfs: "ipfs", kyc: "kyc", xmtp: "xmtp", analytics: "analytics", extract: "extract", inference: "inference", ai: "inference" };
      for (const [kw, match] of Object.entries(keywords)) {
        if (req.includes(kw) && id.includes(match)) score += 15;
      }
      if (score > bestScore) { bestScore = score; bestMatch = offering; }
    }
    return bestScore >= 4 ? bestMatch : null;
  }

  private extractParams(job: AcpJob, offering: JobOffering): Record<string, any> {
    if (job.params && typeof job.params === "object" && Object.keys(job.params).length > 0) return job.params;
    const req = job.serviceRequirement || "";
    try { const m = req.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
    return { raw_request: req };
  }

  async handleJob(job: AcpJob): Promise<JobResult> {
    const start = Date.now();
    this.stats.totalJobs++;
    console.log(`\n[handler] === New ACP Job: ${job.id} ===`);
    console.log(`[handler] Requirement: ${job.serviceRequirement}`);

    const offering = this.resolveOffering(job);
    if (!offering) {
      console.log(`[handler] X No matching offering`);
      await job.reject(`Could not match request. Available: ${LIVE_OFFERINGS.map(o => o.name).join(", ")}`);
      this.stats.failedJobs++;
      return { success: false, offeringId: "unknown", offeringName: "Unknown", error: "No match", executionTimeMs: Date.now() - start };
    }

    console.log(`[handler] Matched: ${offering.name} ($${offering.acpPrice})`);
    try { await job.accept(`Processing ${offering.name} via x402 gateway.`); } catch (e: any) { console.error(`Accept failed: ${e.message}`); }

    const params = this.extractParams(job, offering);
    console.log(`[handler] Calling gateway...`);
    const result = await this.gateway.executeJob(offering.id, params);

    if (result.success) {
      console.log(`[handler] OK (${result.latencyMs}ms)`);
      const deliverable = { service: offering.name, status: "completed", result: result.data, execution_time_ms: result.latencyMs, powered_by: "Spraay x402 Gateway" };
      try { await job.deliver(JSON.stringify(deliverable)); console.log(`[handler] Delivered`); } catch (e: any) { console.error(`Deliver failed: ${e.message}`); }
      this.stats.successfulJobs++;
      this.stats.totalRevenue += parseFloat(offering.acpPrice);
      this.stats.totalGatewayCost += parseFloat(offering.gatewayCost);
    } else {
      console.log(`[handler] FAIL: ${result.error}`);
      try { await job.deliver(JSON.stringify({ service: offering.name, status: "failed", error: result.error })); } catch {}
      this.stats.failedJobs++;
    }

    this.printStats();
    return { success: result.success, offeringId: offering.id, offeringName: offering.name, gatewayResponse: result, executionTimeMs: Date.now() - start };
  }

  printStats() {
    const margin = this.stats.totalRevenue - this.stats.totalGatewayCost;
    console.log(`[stats] Jobs: ${this.stats.totalJobs} | OK: ${this.stats.successfulJobs} | FAIL: ${this.stats.failedJobs} | Rev: $${this.stats.totalRevenue.toFixed(2)} | Cost: $${this.stats.totalGatewayCost.toFixed(3)} | Margin: $${margin.toFixed(2)}`);
  }

  getStats() { return { ...this.stats }; }
}
'@ | Out-File -Encoding utf8 src/job-handler.ts

# === src/index.ts ===
@'
import "dotenv/config";
import { SpraayGatewayClient } from "./gateway-client.js";
import { JobHandler, AcpJob } from "./job-handler.js";
import { AGENT_PROFILE, LIVE_OFFERINGS } from "./offerings.js";

const CONFIG = {
  sellerWalletAddress: process.env.SELLER_AGENT_WALLET_ADDRESS || "",
  sessionEntityKeyId: process.env.SESSION_ENTITY_KEY_ID || "",
  whitelistedPrivateKey: process.env.WHITELISTED_WALLET_PRIVATE_KEY || "",
  customRpcUrl: process.env.CUSTOM_RPC_URL || undefined,
  gatewayUrl: process.env.SPRAAY_GATEWAY_URL || "https://gateway.spraay.app",
  x402PrivateKey: process.env.X402_WALLET_PRIVATE_KEY || "",
};

function validateConfig(): boolean {
  const required: [string, string][] = [
    ["SELLER_AGENT_WALLET_ADDRESS", CONFIG.sellerWalletAddress],
    ["SESSION_ENTITY_KEY_ID", CONFIG.sessionEntityKeyId],
    ["WHITELISTED_WALLET_PRIVATE_KEY", CONFIG.whitelistedPrivateKey],
  ];
  let valid = true;
  for (const [name, value] of required) {
    if (!value) { console.error(`[config] Missing: ${name}`); valid = false; }
  }
  return valid;
}

async function main() {
  console.log(`\n  Spraay Agent - ACP Provider`);
  console.log(`  Gateway:  ${CONFIG.gatewayUrl}`);
  console.log(`  Services: ${LIVE_OFFERINGS.length} live offerings`);
  console.log(`  Chain:    Base\n`);

  console.log("[boot] Offerings:");
  for (const o of LIVE_OFFERINGS) {
    console.log(`  T${o.tier} | $${o.acpPrice.padEnd(5)} | ${o.name.padEnd(22)} | ${o.gatewayEndpoint}`);
  }
  console.log();

  if (!validateConfig()) { process.exit(1); }

  const gateway = new SpraayGatewayClient(CONFIG.gatewayUrl, CONFIG.x402PrivateKey);
  console.log("[boot] Checking gateway...");
  const healthy = await gateway.healthCheck();
  console.log(healthy ? "[boot] Gateway is live" : "[boot] Gateway check failed - continuing");

  const handler = new JobHandler(gateway);

  // === REAL ACP CLIENT ===
  // Uncomment this block when ready to connect to ACP:
  //
  // import AcpClient, { AcpContractClientV2 } from "@virtuals-protocol/acp-node";
  //
  // const acpClient = new AcpClient({
  //   acpContractClient: await AcpContractClientV2.build(
  //     CONFIG.whitelistedPrivateKey,
  //     CONFIG.sessionEntityKeyId,
  //     CONFIG.sellerWalletAddress,
  //     CONFIG.customRpcUrl,
  //   ),
  //   onNewTask: async (job: AcpJob) => { await handler.handleJob(job); },
  //   onEvaluate: async (job: AcpJob) => { console.log(`[eval] Job ${job.id}`); },
  // });
  // await acpClient.init();
  // console.log("[boot] Connected to ACP");

  // === MOCK MODE ===
  if (process.env.MOCK_MODE === "true") {
    console.log("[mock] Simulating incoming jobs...\n");
    const mockJobs = [
      { id: "mock_001", serviceRequirement: "Get ETH and USDC prices", params: { tokens: "ETH,USDC" } },
      { id: "mock_002", serviceRequirement: "Token swap quote", params: { from: "USDC", to: "WETH", amount: "100" } },
      { id: "mock_003", serviceRequirement: "Web search x402 protocol", params: { query: "x402 protocol", max_results: 3 } },
    ];
    let idx = 0;
    setInterval(async () => {
      const m = mockJobs[idx % mockJobs.length]; idx++;
      const mockJob: AcpJob = {
        id: `${m.id}_${idx}`, serviceRequirement: m.serviceRequirement, params: m.params,
        accept: async (r) => console.log(`[mock] Accepted: ${r}`),
        reject: async (r) => console.log(`[mock] Rejected: ${r}`),
        createRequirement: async (r) => console.log(`[mock] Requirement:`, r),
        deliver: async (d) => { const p = JSON.parse(d); console.log(`[mock] Delivered: ${p.service} - ${p.status}`); },
      };
      await handler.handleJob(mockJob);
    }, 15000);
  }

  console.log("[boot] Spraay Agent running. Waiting for jobs...\n");
  process.on("SIGINT", () => { console.log("\nShutting down..."); handler.printStats(); process.exit(0); });
  setInterval(() => { const s = handler.getStats(); if (s.totalJobs > 0) handler.printStats(); }, 60000);
}

main().catch((err) => { console.error("[fatal]", err); process.exit(1); });
'@ | Out-File -Encoding utf8 src/index.ts

Write-Host ""
Write-Host "All files created! Now run:" -ForegroundColor Green
Write-Host "  npm install" -ForegroundColor Cyan
Write-Host "  npm install @virtuals-protocol/acp-node" -ForegroundColor Cyan
Write-Host "  copy .env.example .env" -ForegroundColor Cyan
Write-Host "  # Edit .env with your keys" -ForegroundColor Yellow
Write-Host '  $env:MOCK_MODE="true"; npm run dev' -ForegroundColor Cyan
