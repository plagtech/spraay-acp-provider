/**
 * index.ts — Spraay ACP Provider v2.0
 *
 * Merged entry point: keeps your existing ACP polling mode, x402 gateway,
 * mock mode, and stats — now with Claude reasoning as the primary job handler.
 *
 * Architecture:
 *   ACP SDK (polling) → Job Handler → Claude Engine → x402 Gateway
 *                                   ↘ Keyword Router (fallback) ↗
 *
 * Revenue layers:
 *   1. x402 micropayments on each gateway call
 *   2. ACP job fees (set in your agent profile on agdp.io)
 *   3. aGDP token rewards (after token launch)
 */

import "dotenv/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const acpPkg = require("@virtuals-protocol/acp-node");
const AcpClient = acpPkg.default;
const { AcpContractClientV2 } = acpPkg;

import { SpraayGatewayClient } from "./gateway-client.js";
import { JobHandler, type AcpJob } from "./job-handler.js";
import { AGENT_PROFILE, LIVE_OFFERINGS } from "./offerings.js";

// ─── Configuration ──────────────────────────────────────────────
const CONFIG = {
  // ACP credentials
  sellerWalletAddress: process.env.SELLER_AGENT_WALLET_ADDRESS || "",
  sessionEntityKeyId: process.env.SESSION_ENTITY_KEY_ID || "",
  whitelistedPrivateKey: process.env.WHITELISTED_WALLET_PRIVATE_KEY || "",
  customRpcUrl: process.env.CUSTOM_RPC_URL || undefined,
  // Spraay gateway
  gatewayUrl: process.env.SPRAAY_GATEWAY_URL || "https://gateway.spraay.app",
  x402PrivateKey: process.env.X402_WALLET_PRIVATE_KEY || "",
  // Claude
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  useClaudeReasoning: process.env.USE_CLAUDE_REASONING !== "false",
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
  if (!CONFIG.anthropicKey) {
    console.warn(`  ⚠ No ANTHROPIC_API_KEY — Claude reasoning disabled, using keyword routing`);
  }
  return valid;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   💧 Spraay ACP Provider v2.0            ║
  ║   Powered by Claude + x402               ║
  ╚═══════════════════════════════════════════╝
  Gateway:   ${CONFIG.gatewayUrl}
  Services:  ${LIVE_OFFERINGS.length} live offerings
  Chain:     Base
  Reasoning: ${CONFIG.anthropicKey && CONFIG.useClaudeReasoning ? "Claude AI 🧠" : "Keyword routing 📋"}
  Mode:      ${CONFIG.mockMode ? "MOCK (local testing)" : "LIVE"}
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

  if (!validateConfig()) {
    console.error("\n  Fix missing env vars and restart.\n");
    process.exit(1);
  }

  // ─── Initialize gateway client (with x402 payments) ───────────
  const gateway = new SpraayGatewayClient(CONFIG.gatewayUrl, CONFIG.x402PrivateKey);
  await gateway.init();

  console.log("[boot] Checking gateway health...");
  const healthy = await gateway.healthCheck();
  console.log(healthy ? "[boot] ✓ Gateway is live" : "[boot] ⚠ Gateway health check failed — continuing");

  // ─── Initialize job handler (with Claude or keyword fallback) ──
  const handler = new JobHandler(gateway, {
    useClaude: CONFIG.useClaudeReasoning && !!CONFIG.anthropicKey,
  });

  // ─── Connect to ACP (polling mode) ────────────────────────────
  if (!CONFIG.mockMode) {
    console.log("[boot] Connecting to ACP (polling mode)...");
    try {
      const acpContractClient = await AcpContractClientV2.build(
        CONFIG.whitelistedPrivateKey,
        CONFIG.sessionEntityKeyId,
        CONFIG.sellerWalletAddress,
        CONFIG.customRpcUrl,
      );
      const acpClient = new AcpClient({
        acpContractClient,
      });
      // Don't call acpClient.init() — avoids websocket auth issues
      console.log("[boot] ✓ Connected to ACP — polling mode\n");

      // Poll for new jobs every 30 seconds
      setInterval(async () => {
        try {
          const activeJobs = await acpClient.getActiveJobs(1, 10);
          if (activeJobs && activeJobs.length > 0) {
            for (const job of activeJobs) {
              console.log(`[poll] Found job: ${job.id}`);
              await handler.handleJob(job);
            }
          }
        } catch (err: any) {
          console.warn(`[poll] Error: ${err.message?.slice(0, 100)}`);
        }
      }, 30000);
    } catch (err: any) {
      console.error(`[boot] ✗ ACP connection failed: ${err.message}`);
      process.exit(1);
    }
  }

  // ─── Mock mode for local testing ──────────────────────────────
  if (CONFIG.mockMode) {
    console.log("[mock] Running in mock mode — simulating incoming jobs\n");
    const mockJobs = [
      { id: "mock_price", serviceRequirement: "Get ETH and USDC prices", params: { tokens: "ETH,USDC" } },
      { id: "mock_swap", serviceRequirement: "Token swap quote USDC to WETH", params: { from: "USDC", to: "WETH", amount: "100" } },
      { id: "mock_multi", serviceRequirement: "Get the current price of ETH, then give me a swap quote to trade 100 USDC for WETH on Base" },
      { id: "mock_search", serviceRequirement: "Web search for x402 protocol", params: { query: "x402 protocol", max_results: 3 } },
      { id: "mock_invoice", serviceRequirement: "Create an invoice for 500 USDC to 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for consulting services" },
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
          const p = typeof d === "string" ? JSON.parse(d) : d;
          console.log(`  [mock] 📦 Delivered: ${p.status || "ok"} | Services: ${p.services_used?.join(", ") || p.service || "—"}`);
        },
      };
      await handler.handleJob(mockJob);
    }, 25000);
  }

  // ─── Keep alive ───────────────────────────────────────────────
  console.log("[boot] 💧 Spraay ACP Provider running. Waiting for jobs...\n");

  setInterval(() => {
    const s = handler.getStats();
    if (s.totalJobs > 0) handler.printStats();
  }, 120000);

  process.on("SIGINT", () => {
    console.log("\n[shutdown] Shutting down Spraay ACP Provider...");
    handler.printStats();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[shutdown] SIGTERM received");
    handler.printStats();
    process.exit(0);
  });

  // Catch ACP SDK background errors so they don't crash the process
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
