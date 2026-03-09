/**
 * test-buyer.ts
 *
 * Spraay ACP Buyer — Fires test jobs at the Spraay seller agent
 * to help it graduate (10 successful jobs, 3 consecutive).
 *
 * Usage (PowerShell):
 *   npx tsx src/test-buyer.ts
 */

import "dotenv/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const acpPkg = require("@virtuals-protocol/acp-node");
const AcpClient = acpPkg.default;
const { AcpContractClientV2, AcpGraduationStatus, AcpOnlineStatus } = acpPkg;

// ─── Configuration ──────────────────────────────────────────────

const CONFIG = {
  buyerWalletAddress: process.env.BUYER_AGENT_WALLET_ADDRESS || "",
  buyerEntityKeyId: process.env.BUYER_SESSION_ENTITY_KEY_ID || "2",
  buyerPrivateKey: process.env.BUYER_WHITELISTED_WALLET_PRIVATE_KEY || "",
  sellerWalletAddress: process.env.SELLER_AGENT_WALLET_ADDRESS || "0xfEb79d4DE3d0F1602142C548B4CF9835c3576ADe",
  totalJobs: 12,
  delayBetweenJobsMs: 60000,
};

// ─── Test Jobs ──────────────────────────────────────────────────

const TEST_JOBS = [
  "Get current ETH and USDC prices",
  "Get a swap quote for 100 USDC to WETH on Base",
  "Get the current price of Bitcoin",
  "Analyze wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 on Base",
  "Using GPT-4o, explain what x402 protocol is in 2 sentences",
  "Search for Spraay crypto batch payments protocol",
  "Get the latest block number on Base chain",
  "Get current prices for ETH, USDC, and VIRTUAL token",
  "Quote swapping 50 USDC to ETH on Base with 0.5% slippage",
  "What is the Agent Commerce Protocol by Virtuals?",
  "Get the current gas price on Base and ETH price",
  "Get portfolio summary for 0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   💧 Spraay ACP Buyer — Graduation Bot   ║
  ╚═══════════════════════════════════════════╝
  Buyer:   ${CONFIG.buyerWalletAddress.slice(0, 12)}...
  Seller:  ${CONFIG.sellerWalletAddress.slice(0, 12)}...
  Jobs:    ${CONFIG.totalJobs} planned
  Delay:   ${CONFIG.delayBetweenJobsMs / 1000}s between jobs
  `);

  if (!CONFIG.buyerPrivateKey) {
    console.error("✗ Missing BUYER_WHITELISTED_WALLET_PRIVATE_KEY");
    process.exit(1);
  }
  if (!CONFIG.buyerWalletAddress) {
    console.error("✗ Missing BUYER_AGENT_WALLET_ADDRESS");
    process.exit(1);
  }

  // ─── Initialize ACP client as buyer ─────────────────────────
  console.log("[buyer] Connecting to ACP...");

  const acpContractClient = await AcpContractClientV2.build(
    CONFIG.buyerPrivateKey,
    parseInt(CONFIG.buyerEntityKeyId, 10),
    CONFIG.buyerWalletAddress,
  );

  const acpClient = new AcpClient({
    acpContractClient,
    onEvaluate: async (job: any) => {
      console.log(`[eval] Auto-accepting deliverable for job ${job.id}`);
      try {
        await job.evaluate(true, "Deliverable accepted — graduation test");
      } catch (err: any) {
        console.warn(`[eval] Error: ${err.message?.slice(0, 80)}`);
      }
    },
  });

  await acpClient.init();
  console.log("[buyer] ✓ Connected to ACP\n");

  // ─── Find the seller agent ────────────────────────────────────
  console.log("[buyer] Searching for Spraay seller agent...");

  let chosenOffering: any = null;

  try {
    const agents = await acpClient.browseAgents(
      "Spraay",
      {
        top_k: 10,
        graduationStatus: AcpGraduationStatus?.ALL ?? "ALL",
        onlineStatus: AcpOnlineStatus?.ALL ?? "ALL",
        showHiddenOfferings: true,
      }
    );

    if (agents && agents.length > 0) {
      console.log(`[buyer] Found ${agents.length} agents`);
      for (const a of agents) {
        console.log(`[buyer]   - ${a.name} (${a.walletAddress?.slice(0, 10)}...) offerings: ${a.jobOfferings?.length || 0}`);
      }

      const sellerAgent = agents.find((a: any) =>
        a.walletAddress?.toLowerCase() === CONFIG.sellerWalletAddress.toLowerCase()
      ) || agents.find((a: any) =>
        a.name?.toLowerCase().includes("spraay")
      );

      if (sellerAgent && sellerAgent.jobOfferings?.length > 0) {
        chosenOffering = sellerAgent.jobOfferings[0];
        console.log(`[buyer] ✓ Using offering: "${chosenOffering.name}" ($${chosenOffering.price})`);
      } else if (sellerAgent) {
        console.log(`[buyer] ⚠ Found seller but no offerings listed`);
      }
    } else {
      console.log("[buyer] ⚠ No agents found");
    }
  } catch (err: any) {
    console.warn(`[buyer] browseAgents error: ${err.message?.slice(0, 150)}`);
    console.warn("[buyer] Will try direct job initiation instead");
  }

  // ─── Send jobs ──────────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;
  let consecutiveSuccess = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < CONFIG.totalJobs; i++) {
    const jobDesc = TEST_JOBS[i % TEST_JOBS.length];
    const jobNum = i + 1;

    console.log(`\n${"─".repeat(50)}`);
    console.log(`[job ${jobNum}/${CONFIG.totalJobs}] 📤 "${jobDesc}"`);

    try {
      let jobId: number;

      if (chosenOffering) {
        console.log(`[job ${jobNum}] Via offering: ${chosenOffering.name}`);
        jobId = await chosenOffering.initiateJob(
          jobDesc,
          CONFIG.buyerWalletAddress, // evaluator = self (skip-evaluation pattern)
        );
      } else {
        console.log(`[job ${jobNum}] Direct initiation...`);
        jobId = await acpClient.initiateJob(
          CONFIG.sellerWalletAddress,
          jobDesc,
        );
      }

      console.log(`[job ${jobNum}] ✓ Created: ID ${jobId}`);

      // Poll for completion
      let completed = false;
      const maxWaitMs = 180000;
      const pollIntervalMs = 15000;
      const startTime = Date.now();

      while (!completed && (Date.now() - startTime) < maxWaitMs) {
        await sleep(pollIntervalMs);

        try {
          const job = await acpClient.getJobById(jobId);
          if (!job) {
            console.log(`[job ${jobNum}] Job not found yet...`);
            continue;
          }

          const phaseNames: Record<number, string> = {
            0: "REQUEST", 1: "NEGOTIATION", 2: "TRANSACTION",
            3: "EVALUATION", 4: "COMPLETED", 5: "REJECTED", 6: "EXPIRED"
          };
          console.log(`[job ${jobNum}] Phase: ${phaseNames[job.phase] || job.phase}`);

          if (job.phase === 2) { // TRANSACTION — pay
            try {
              await job.payAndAcceptRequirement();
              console.log(`[job ${jobNum}] ✓ Paid`);
            } catch (e: any) {
              if (!e.message?.includes("already")) {
                console.warn(`[job ${jobNum}] Pay: ${e.message?.slice(0, 60)}`);
              }
            }
          }

          if (job.phase === 3) { // EVALUATION — accept
            try {
              await job.evaluate(true, "Accepted");
              console.log(`[job ${jobNum}] ✓ Evaluated`);
            } catch (e: any) {
              console.warn(`[job ${jobNum}] Eval: ${e.message?.slice(0, 60)}`);
            }
          }

          if (job.phase === 4) { // COMPLETED
            console.log(`[job ${jobNum}] ✅ COMPLETED`);
            completed = true;
            successCount++;
            consecutiveSuccess++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveSuccess);
          }

          if (job.phase >= 5) { // REJECTED or EXPIRED
            console.log(`[job ${jobNum}] ❌ ${phaseNames[job.phase]}`);
            completed = true;
            failCount++;
            consecutiveSuccess = 0;
          }
        } catch (pollErr: any) {
          console.warn(`[job ${jobNum}] Poll: ${pollErr.message?.slice(0, 60)}`);
        }
      }

      if (!completed) {
        console.log(`[job ${jobNum}] ⏰ Timed out`);
        failCount++;
        consecutiveSuccess = 0;
      }

    } catch (err: any) {
      console.error(`[job ${jobNum}] ✗ ${err.message?.slice(0, 150)}`);
      failCount++;
      consecutiveSuccess = 0;
    }

    console.log(`\n[progress] ✓ ${successCount} | ✗ ${failCount} | Consecutive: ${consecutiveSuccess} | Max: ${maxConsecutive}`);
    console.log(`[progress] Graduation: ${successCount}/10, ${maxConsecutive}/3 consecutive`);

    if (successCount >= 10 && maxConsecutive >= 3) {
      console.log("\n🎉 GRADUATION REQUIREMENTS MET!");
      break;
    }

    if (i < CONFIG.totalJobs - 1) {
      console.log(`\n[buyer] Waiting ${CONFIG.delayBetweenJobsMs / 1000}s...`);
      await sleep(CONFIG.delayBetweenJobsMs);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Successful: ${successCount} | Failed: ${failCount} | Max consecutive: ${maxConsecutive}`);
  console.log(`  Ready: ${successCount >= 10 && maxConsecutive >= 3 ? "✅ YES" : "❌ NOT YET"}`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
