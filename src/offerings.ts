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
  github: "https://github.com/plagtech/spraay-acp-agent",
  twitter: "@Spraay_app",
  totalOfferings: JOB_OFFERINGS.length,
  liveOfferings: LIVE_OFFERINGS.length
};
