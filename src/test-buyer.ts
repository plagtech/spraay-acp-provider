/**
 * test-buyer.ts — Send test jobs to your Spraay ACP seller agent.
 *
 * Uses the SDK's recommended flow:
 *   1. browseAgents("spraay") to find the seller
 *   2. Pick an offering from the seller's registered offerings
 *   3. offering.initiateJob() to create the job
 *
 * Run:  npx tsx src/test-buyer.ts
 */

import "dotenv/config";
import pkg from "@virtuals-protocol/acp-node";
const AcpClient = (pkg as any).default || pkg;
const { AcpContractClientV2 } = pkg as any;

// ─── Buyer config ───────────────────────────────────────────────
const BUYER_WALLET = process.env.BUYER_AGENT_WALLET_ADDRESS || "";
const BUYER_ENTITY_ID = process.env.BUYER_SESSION_ENTITY_KEY_ID || "";
const BUYER_KEY = process.env.BUYER_WHITELISTED_PRIVATE_KEY || "";
const CUSTOM_RPC = process.env.CUSTOM_RPC_URL || undefined;

// Seller wallet for direct initiation fallback
const SELLER_WALLET = process.env.SELLER_AGENT_WALLET_ADDRESS || "";

async function main() {
  console.log(`\n  🧪 Spraay ACP Test Buyer`);
  console.log(`  Buyer:  ${BUYER_WALLET}`);
  console.log(`  Seller: ${SELLER_WALLET}\n`);

  if (!BUYER_WALLET || !BUYER_ENTITY_ID || !BUYER_KEY) {
    console.error("  ✗ Set BUYER_AGENT_WALLET_ADDRESS, BUYER_SESSION_ENTITY_KEY_ID, BUYER_WHITELISTED_PRIVATE_KEY");
    process.exit(1);
  }

  // Catch background auth errors
  process.on("unhandledRejection", (reason: any) => {
    const msg = reason?.message || String(reason);
    if (msg.includes("auth challenge") || msg.includes("refreshToken")) {
      console.warn(`[buyer] ⚠ Auth refresh (non-fatal): ${msg.slice(0, 80)}`);
    } else {
      console.error("[buyer] Unhandled:", msg.slice(0, 200));
    }
  });

  // ─── Connect ──────────────────────────────────────────────────
  console.log("[buyer] Connecting to ACP...");
  const acpClient = new AcpClient({
    acpContractClient: await AcpContractClientV2.build(
      BUYER_KEY,
      BUYER_ENTITY_ID,
      BUYER_WALLET,
      CUSTOM_RPC,
    ),
    onEvaluate: async (job: any) => {
      console.log(`\n[buyer] 📋 Evaluating job ${job.id}`);
      console.log(`[buyer] Deliverable preview:`, String(job.deliverable || "").slice(0, 300));
      try {
        if (job.evaluate) {
          await job.evaluate(true, "Deliverable received and accepted.");
          console.log(`[buyer] ✓ Approved job ${job.id}\n`);
        }
      } catch (e: any) {
        console.error(`[buyer] Evaluate failed: ${e.message}`);
      }
    },
  });
  await acpClient.init();
  console.log("[buyer] ✓ Connected\n");

  // ─── Browse for Spraay agent ──────────────────────────────────
  console.log("[buyer] Searching for Spraay agent...");
  let sellerAgent: any = null;
  let offerings: any[] = [];

  try {
    const agents = await acpClient.browseAgents("spraay", {
      top_k: 10,
      showHiddenOfferings: true,
    });
    console.log(`[buyer] Found ${agents?.length || 0} agents`);

    if (agents && agents.length > 0) {
      // Find our Spraay agent
      for (const agent of agents) {
        const addr = (agent.walletAddress || agent.wallet || "").toLowerCase();
        const name = (agent.name || "").toLowerCase();
        if (addr.includes("feb7") || name.includes("spraay")) {
          sellerAgent = agent;
          offerings = agent.offerings || [];
          break;
        }
      }

      if (!sellerAgent && agents.length > 0) {
        // Just use the first result
        sellerAgent = agents[0];
        offerings = agents[0].offerings || [];
      }
    }
  } catch (err: any) {
    console.warn(`[buyer] Browse failed: ${err.message}`);
  }

  if (sellerAgent) {
    console.log(`[buyer] Found: ${sellerAgent.name || "Unknown"} (${offerings.length} offerings)`);
    for (const o of offerings) {
      console.log(`  - ${o.name || o.serviceName || "unnamed"}: $${o.price || o.fare || "?"}`);
    }
  } else {
    console.log("[buyer] Could not find Spraay via browse. Using direct initiation.");
  }

  // ─── Test jobs ────────────────────────────────────────────────
  const testRequirements = [
    "Get current ETH and USDC token prices",
    "Get a swap quote for 100 USDC to WETH on Base",
    "Search the web for x402 protocol information",
  ];

  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  for (const requirement of testRequirements) {
    console.log(`\n[buyer] 📤 Sending: "${requirement.slice(0, 60)}..."`);

    try {
      let jobId: any;

      if (offerings.length > 0) {
        // Method 1: Use offering's initiateJob (preferred)
        const offering = offerings[0]; // Use first available offering
        console.log(`[buyer] Using offering: ${offering.name || offering.serviceName}`);
        jobId = await offering.initiateJob(
          requirement,
          "", // no external evaluator
          expiry,
        );
      } else if (SELLER_WALLET) {
        // Method 2: Direct initiation by wallet address
        console.log(`[buyer] Direct initiation to ${SELLER_WALLET.slice(0, 10)}...`);
        jobId = await acpClient.initiateJob(
          SELLER_WALLET,
          requirement,
          0.01, // $0.01 USDC test price
          "", // no external evaluator
          expiry,
        );
      } else {
        console.error("[buyer] No seller found and no SELLER_AGENT_WALLET_ADDRESS set");
        continue;
      }

      console.log(`[buyer] ✓ Job created: ${jobId}`);
    } catch (err: any) {
      console.error(`[buyer] ✗ Failed: ${err.message?.slice(0, 200)}`);
    }

    // Wait between jobs
    await new Promise((r) => setTimeout(r, 8000));
  }

  // ─── Stay alive to receive evaluations ────────────────────────
  console.log("\n[buyer] All jobs sent. Waiting for deliverables... (Ctrl+C to stop)\n");

  // Keep the process alive
  setInterval(() => {
    // heartbeat
  }, 30000);
}

main().catch((err) => {
  console.error("[fatal]", err.message || err);
  process.exit(1);
});
