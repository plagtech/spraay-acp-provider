import "dotenv/config";
// Handle both default and named exports across acp-node versions
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const acpPkg = require("@virtuals-protocol/acp-node");
const AcpClient = acpPkg.default;
const { AcpContractClientV2 } = acpPkg;
import { SpraayGatewayClient } from "./gateway-client.js";
import { JobHandler, AcpJob } from "./job-handler.js";
import { AGENT_PROFILE, LIVE_OFFERINGS } from "./offerings.js";

// ─── Configuration ──────────────────────────────────────────────
const CONFIG = {
  // ACP credentials (from Virtuals agent dashboard)
  sellerWalletAddress: process.env.SELLER_AGENT_WALLET_ADDRESS || "",
  sessionEntityKeyId: process.env.SESSION_ENTITY_KEY_ID || "",
  whitelistedPrivateKey: process.env.WHITELISTED_WALLET_PRIVATE_KEY || "",
  customRpcUrl: process.env.CUSTOM_RPC_URL || undefined,
  // Spraay gateway
  gatewayUrl: process.env.SPRAAY_GATEWAY_URL || "https://gateway.spraay.app",
  x402PrivateKey: process.env.X402_WALLET_PRIVATE_KEY || "",
  // Mode
  mockMode: process.env.MOCK_MODE === "true",
};

function validateConfig(): boolean {
  const required: [string, string][] = [
    ["SELLER_AGENT_WALLET_ADDRESS", CONFIG.sellerWalletAddress],
    ["SESSION_ENTITY_KEY_ID", CONFIG.sessionEntityKeyId],
    ["WHITELISTED_WALLET_PRIVATE_KEY", CONFIG.whitelistedPrivateKey],
  ];
  let valid = true;
  for (const [name, value] of required) {
    if (!value) {
      console.error(`  ✗ Missing env: ${name}`);
      valid = false;
    }
  }
  if (!CONFIG.x402PrivateKey) {
    console.warn(`  ⚠ No X402_WALLET_PRIVATE_KEY — paid gateway endpoints will fail`);
  }
  return valid;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   💧 Spraay Agent — ACP Provider     ║
  ╚═══════════════════════════════════════╝
  Gateway:  ${CONFIG.gatewayUrl}
  Services: ${LIVE_OFFERINGS.length} live offerings
  Chain:    Base
  Mode:     ${CONFIG.mockMode ? "MOCK (local testing)" : "LIVE"}
  `);

  // Print offerings table
  console.log("  Offerings:");
  console.log("  ─────────────────────────────────────────────────────────────────");
  for (const o of LIVE_OFFERINGS) {
    console.log(
      `  T${o.tier} | $${o.acpPrice.padEnd(5)} | ${o.name.padEnd(22)} | ${o.gatewayEndpoint}`,
    );
  }
  console.log();

  // Validate config
  if (!validateConfig()) {
    console.error("\n  Fix missing env vars and restart.\n");
    process.exit(1);
  }

  // ─── Initialize gateway client ────────────────────────────────
  const gateway = new SpraayGatewayClient(CONFIG.gatewayUrl, CONFIG.x402PrivateKey);
  await gateway.init(); // sets up x402 payment client

  console.log("[boot] Checking gateway health...");
  const healthy = await gateway.healthCheck();
  console.log(healthy ? "[boot] ✓ Gateway is live" : "[boot] ⚠ Gateway health check failed — continuing");

  // ─── Initialize job handler ───────────────────────────────────
  const handler = new JobHandler(gateway);

  // ─── Connect to ACP ───────────────────────────────────────────
  if (!CONFIG.mockMode) {
    console.log("[boot] Connecting to ACP...");
    try {
      const acpClient = new AcpClient({
        acpContractClient: await AcpContractClientV2.build(
          CONFIG.whitelistedPrivateKey,
          CONFIG.sessionEntityKeyId,
          CONFIG.sellerWalletAddress,
          CONFIG.customRpcUrl,
        ),
        onNewTask: async (job: AcpJob) => {
          console.log(`\n[acp] 🔔 New task received: ${job.id}`);
          await handler.handleJob(job);
        },
        onEvaluate: async (job: AcpJob) => {
          console.log(`[acp] 📋 Evaluation requested for job ${job.id}`);
          // Auto-evaluate positively for now
          if (job.evaluate) {
            await job.evaluate(true, "Job completed successfully via Spraay x402 gateway.");
          }
        },
      });
      await acpClient.init();
      console.log("[boot] ✓ Connected to ACP — ONLINE\n");
    } catch (err: any) {
      console.error(`[boot] ✗ ACP connection failed: ${err.message}`);
      console.error("[boot] Check your SELLER_AGENT_WALLET_ADDRESS, SESSION_ENTITY_KEY_ID, and WHITELISTED_WALLET_PRIVATE_KEY");
      process.exit(1);
    }
  }

  // ─── Mock mode for local testing ──────────────────────────────
  if (CONFIG.mockMode) {
    console.log("[mock] Running in mock mode — simulating incoming jobs\n");
    const mockJobs = [
      { id: "mock_price", serviceRequirement: "Get ETH and USDC prices", params: { tokens: "ETH,USDC" } },
      { id: "mock_swap", serviceRequirement: "Token swap quote USDC to WETH", params: { from: "USDC", to: "WETH", amount: "100" } },
      { id: "mock_search", serviceRequirement: "Web search for x402 protocol", params: { query: "x402 protocol", max_results: 3 } },
      { id: "mock_gpu", serviceRequirement: "Generate an image of a mountain lake", params: { model: "flux-pro", input: { prompt: "a serene mountain lake" } } },
    ];
    let idx = 0;
    setInterval(async () => {
      const m = mockJobs[idx % mockJobs.length];
      idx++;
      const mockJob: AcpJob = {
        id: `${m.id}_${idx}`,
        serviceRequirement: m.serviceRequirement,
        params: m.params,
        accept: async (r) => console.log(`  [mock] ✓ Accepted: ${r}`),
        reject: async (r) => console.log(`  [mock] ✗ Rejected: ${r}`),
        createRequirement: async (r) => console.log(`  [mock] Requirement:`, r),
        deliver: async (d) => {
          const p = JSON.parse(d);
          console.log(`  [mock] 📦 Delivered: ${p.service} — ${p.status}`);
        },
      };
      await handler.handleJob(mockJob);
    }, 20000);
  }

  // ─── Keep alive ───────────────────────────────────────────────
  console.log("[boot] 💧 Spraay Agent running. Waiting for jobs...\n");

  // Periodic stats
  setInterval(() => {
    const s = handler.getStats();
    if (s.totalJobs > 0) handler.printStats();
  }, 120000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[shutdown] Shutting down Spraay Agent...");
    handler.printStats();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[shutdown] SIGTERM received");
    handler.printStats();
    process.exit(0);
  });

  // Catch ACP SDK background errors (auth refresh) so they don't crash the process
  process.on("unhandledRejection", (reason: any) => {
    const msg = reason?.message || String(reason);
    if (msg.includes("auth challenge") || msg.includes("refreshToken")) {
      console.warn(`[acp] ⚠ Auth refresh failed (non-fatal): ${msg.slice(0, 100)}`);
    } else {
      console.error("[unhandled]", reason);
    }
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
