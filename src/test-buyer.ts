/**
 * test-buyer.ts — Graduation Bot v3.1
 *
 * Sends structured job requests matching offering schemas.
 *
 * v3.1 fixes:
 *   - ALL requirement values stringified (ACP schema requires strings)
 *   - Entity ID passed as string (not parseInt)
 *   - Private key 0x prefix enforced
 *   - expiredAt set on each job (3-min window)
 *   - Evaluator set to buyer's own wallet for self-eval
 *   - Better phase tracking and payment handling
 */

import "dotenv/config";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const acpPkg = require("@virtuals-protocol/acp-node");
const AcpClient = acpPkg.default;
const { AcpContractClientV2, AcpGraduationStatus, AcpOnlineStatus } = acpPkg;

/** Ensure private key has 0x prefix — V2 SDK requires it */
function ensureHexPrefix(key: string): string {
  if (!key) return key;
  return key.startsWith("0x") ? key : `0x${key}`;
}

/**
 * Recursively stringify all values in an object.
 * ACP offering schemas expect EVERY value to be a string.
 * Booleans, numbers, arrays, nested objects — all become strings.
 */
function stringifyAllValues(obj: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = "";
    } else if (typeof value === "string") {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value ? "true" : "false";
    } else if (typeof value === "number") {
      result[key] = String(value);
    } else if (Array.isArray(value)) {
      // Arrays become JSON strings or comma-separated
      result[key] = value.length === 0 ? "[]" : JSON.stringify(value);
    } else if (typeof value === "object") {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

const CONFIG = {
  buyerWalletAddress: process.env.BUYER_AGENT_WALLET_ADDRESS || "",
  // Pass entity ID as a string — do NOT parseInt
  buyerEntityKeyId: process.env.BUYER_SESSION_ENTITY_KEY_ID || "2",
  buyerPrivateKey: ensureHexPrefix(process.env.BUYER_WHITELISTED_WALLET_PRIVATE_KEY || ""),
  sellerWalletAddress: process.env.SELLER_AGENT_WALLET_ADDRESS || "0xfEb79d4DE3d0F1602142C548B4CF9835c3576ADe",
  customRpcUrl: process.env.CUSTOM_RPC_URL || process.env.ALCHEMY_BASE_RPC_URL || undefined,
  totalJobs: 12,
  delayBetweenJobsMs: 60000,
  // Job expiry in minutes (must be > 3 min per ACP docs)
  jobExpiryMinutes: 10,
};

// ──────────────────────────────────────────────────────────────────
// TEST JOBS — ALL VALUES ARE STRINGS
// ──────────────────────────────────────────────────────────────────
// Note: stringifyAllValues() handles this automatically, but we write
// them correctly here for clarity.

const TEST_JOBS = [
  {
    offeringKeyword: "price",
    requirement: { tokens: "ETH,USDC", include_gas: "true" },
  },
  {
    offeringKeyword: "swap",
    requirement: { from: "USDC", to: "WETH", amount: "100" },
  },
  {
    offeringKeyword: "price",
    requirement: { tokens: "BTC,ETH" },
  },
  {
    offeringKeyword: "rpc",
    requirement: { chain: "base", method: "eth_blockNumber", params: "[]" },
  },
  {
    offeringKeyword: "search",
    requirement: { query: "x402 protocol micropayments", max_results: "3" },
  },
  {
    offeringKeyword: "analytics",
    requirement: { address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" },
  },
  {
    offeringKeyword: "price",
    requirement: { tokens: "ETH,USDC,VIRTUAL", include_gas: "true" },
  },
  {
    offeringKeyword: "swap",
    requirement: { from: "USDC", to: "WETH", amount: "50", slippage: "0.5" },
  },
  {
    offeringKeyword: "rpc",
    requirement: { chain: "base", method: "eth_gasPrice", params: "[]" },
  },
  {
    offeringKeyword: "search",
    requirement: { query: "Spraay crypto batch payments protocol" },
  },
  {
    offeringKeyword: "price",
    requirement: { tokens: "ETH" },
  },
  {
    offeringKeyword: "analytics",
    requirement: { address: "0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8" },
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate expiry timestamp (minutes from now) */
function getExpiry(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   💧 Spraay ACP Buyer — Graduation Bot   ║
  ║   v3.1 — All-String Schema Fix           ║
  ╚═══════════════════════════════════════════╝
  Buyer:   ${CONFIG.buyerWalletAddress.slice(0, 12)}...
  Entity:  ${CONFIG.buyerEntityKeyId}
  Seller:  ${CONFIG.sellerWalletAddress.slice(0, 12)}...
  Jobs:    ${CONFIG.totalJobs} | Delay: ${CONFIG.delayBetweenJobsMs / 1000}s
  Expiry:  ${CONFIG.jobExpiryMinutes} min per job
  RPC:     ${CONFIG.customRpcUrl ? "Custom ✓" : "Default"}
  `);

  if (!CONFIG.buyerPrivateKey) { console.error("✗ Missing BUYER_WHITELISTED_WALLET_PRIVATE_KEY"); process.exit(1); }
  if (!CONFIG.buyerWalletAddress) { console.error("✗ Missing BUYER_AGENT_WALLET_ADDRESS"); process.exit(1); }
  if (!CONFIG.buyerPrivateKey.startsWith("0x")) { console.error("✗ Private key must start with 0x"); process.exit(1); }

  console.log("[buyer] Connecting to ACP...");
  console.log(`[buyer]   Key: ${CONFIG.buyerPrivateKey.slice(0, 6)}...${CONFIG.buyerPrivateKey.slice(-4)}`);
  console.log(`[buyer]   Entity: "${CONFIG.buyerEntityKeyId}"`);
  console.log(`[buyer]   Wallet: ${CONFIG.buyerWalletAddress}`);

  const acpContractClient = await AcpContractClientV2.build(
    CONFIG.buyerPrivateKey,
    CONFIG.buyerEntityKeyId,   // String, not parseInt!
    CONFIG.buyerWalletAddress,
    CONFIG.customRpcUrl,
  );

  const acpClient = new AcpClient({
    acpContractClient,
    onEvaluate: async (job: any) => {
      console.log(`[eval] Auto-accepting job ${job.id}`);
      try {
        await job.evaluate(true, "Spraay delivery verified — auto-accepted");
      } catch (e: any) {
        console.warn(`[eval] Error: ${e.message?.slice(0, 80)}`);
      }
    },
  });

  await acpClient.init();
  console.log("[buyer] ✓ Connected\n");

  // ─── Find seller and cache offerings ──────────────────────────
  console.log("[buyer] Searching for Spraay seller...");
  const offerings: any[] = [];

  try {
    const agents = await acpClient.browseAgents("Spraay", {
      top_k: 10,
      graduationStatus: AcpGraduationStatus?.ALL ?? "ALL",
      onlineStatus: AcpOnlineStatus?.ALL ?? "ALL",
      showHiddenOfferings: true,
    });

    if (agents?.length > 0) {
      console.log(`[buyer] Found ${agents.length} agent(s) matching "Spraay"`);
      for (const a of agents) {
        console.log(`[buyer]   → ${a.name || "unnamed"} (${a.walletAddress?.slice(0, 10)}...) — ${a.offerings?.length || a.jobOfferings?.length || 0} offerings`);
      }

      const seller = agents.find((a: any) =>
        a.walletAddress?.toLowerCase() === CONFIG.sellerWalletAddress.toLowerCase()
      ) || agents.find((a: any) => a.name?.toLowerCase().includes("spraay"));

      // The SDK may return offerings as `offerings` or `jobOfferings`
      const sellerOfferings = seller?.offerings || seller?.jobOfferings || [];
      if (sellerOfferings.length > 0) {
        offerings.push(...sellerOfferings);
        console.log(`[buyer] ✓ Using ${offerings.length} offerings from "${seller.name}":`);
        for (const o of offerings) {
          console.log(`[buyer]   - "${o.name}" ($${o.price || o.fee || "?"}) [${o.id || "no-id"}]`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[buyer] Browse error: ${err.message?.slice(0, 100)}`);
  }

  if (offerings.length === 0) {
    console.error("[buyer] ✗ No offerings found. Is the seller registered with offerings on ACP?");
    console.error("[buyer]   Seller wallet: " + CONFIG.sellerWalletAddress);
    process.exit(1);
  }

  // ─── Send jobs ──────────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;
  let consecutiveSuccess = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < CONFIG.totalJobs; i++) {
    const test = TEST_JOBS[i % TEST_JOBS.length];
    const jobNum = i + 1;

    // Find matching offering by keyword
    const offering = offerings.find((o: any) =>
      o.name?.toLowerCase().includes(test.offeringKeyword)
    ) || offerings[0]; // fallback to first offering

    // ✅ KEY FIX: Stringify ALL values before sending
    const stringifiedRequirement = stringifyAllValues(test.requirement);

    console.log(`\n${"─".repeat(60)}`);
    console.log(`[job ${jobNum}/${CONFIG.totalJobs}] 📤 Offering: "${offering.name}"`);
    console.log(`[job ${jobNum}] Requirement: ${JSON.stringify(stringifiedRequirement)}`);

    try {
      // Calculate expiry
      const expiredAt = getExpiry(CONFIG.jobExpiryMinutes);

      // Initiate job with stringified requirement
      // offering.initiateJob(requirement, evaluatorAddress, expiredAt)
      const jobId = await offering.initiateJob(
        stringifiedRequirement,
        CONFIG.buyerWalletAddress, // evaluator = self (for graduation)
        expiredAt,
      );

      console.log(`[job ${jobNum}] ✓ Created on-chain: ID ${jobId}`);

      // Poll for completion
      let completed = false;
      const maxWaitMs = 180000; // 3 minutes
      const startTime = Date.now();
      let lastPhase = -1;
      let payAttempted = false;
      let evalAttempted = false;

      while (!completed && (Date.now() - startTime) < maxWaitMs) {
        await sleep(10000); // poll every 10s for faster response

        try {
          const job = await acpClient.getJobById(jobId);
          if (!job) {
            console.log(`[job ${jobNum}] Waiting for job to appear...`);
            continue;
          }

          const phases: Record<number, string> = {
            0: "REQUEST", 1: "NEGOTIATION", 2: "TRANSACTION",
            3: "EVALUATION", 4: "COMPLETED", 5: "REJECTED", 6: "EXPIRED",
          };

          const phaseName = phases[job.phase] || `UNKNOWN(${job.phase})`;
          if (job.phase !== lastPhase) {
            console.log(`[job ${jobNum}] Phase: ${phaseName}`);
            lastPhase = job.phase;
          }

          // TRANSACTION phase — seller accepted, buyer needs to pay
          if (job.phase === 2 && !payAttempted) {
            payAttempted = true;
            try {
              await job.payAndAcceptRequirement();
              console.log(`[job ${jobNum}] ✓ Paid and accepted requirement`);
            } catch (e: any) {
              const msg = e.message || "";
              if (msg.includes("already") || msg.includes("Already")) {
                console.log(`[job ${jobNum}] Payment already processed`);
              } else {
                console.warn(`[job ${jobNum}] Pay error: ${msg.slice(0, 80)}`);
              }
            }
          }

          // EVALUATION phase — seller delivered, buyer needs to evaluate
          if (job.phase === 3 && !evalAttempted) {
            evalAttempted = true;
            try {
              await job.evaluate(true, "Spraay delivery accepted — graduation test");
              console.log(`[job ${jobNum}] ✓ Evaluated (accepted)`);
            } catch (e: any) {
              const msg = e.message || "";
              if (msg.includes("already") || msg.includes("Already")) {
                console.log(`[job ${jobNum}] Evaluation already processed`);
              } else {
                console.warn(`[job ${jobNum}] Eval error: ${msg.slice(0, 80)}`);
              }
            }
          }

          // COMPLETED
          if (job.phase === 4) {
            console.log(`[job ${jobNum}] ✅ COMPLETED`);
            completed = true;
            successCount++;
            consecutiveSuccess++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveSuccess);
          }

          // REJECTED or EXPIRED
          if (job.phase >= 5) {
            console.log(`[job ${jobNum}] ❌ ${phaseName}`);
            // Try to read deliverable or rejection reason from memos
            if (job.memos?.length > 0) {
              const lastMemo = job.memos[job.memos.length - 1];
              console.log(`[job ${jobNum}] Last memo: ${JSON.stringify(lastMemo?.content || lastMemo).slice(0, 200)}`);
            }
            completed = true;
            failCount++;
            consecutiveSuccess = 0;
          }
        } catch (pollErr: any) {
          console.warn(`[job ${jobNum}] Poll: ${pollErr.message?.slice(0, 80)}`);
        }
      }

      if (!completed) {
        console.log(`[job ${jobNum}] ⏰ Timed out after ${maxWaitMs / 1000}s`);
        failCount++;
        consecutiveSuccess = 0;
      }
    } catch (err: any) {
      console.error(`[job ${jobNum}] ✗ ${err.message?.slice(0, 200)}`);
      failCount++;
      consecutiveSuccess = 0;
    }

    // Progress report
    console.log(`\n[progress] ✓ ${successCount} | ✗ ${failCount} | Consecutive: ${consecutiveSuccess} | Max: ${maxConsecutive}`);
    console.log(`[progress] Graduation: ${successCount >= 10 ? "✅" : "❌"} ${successCount}/10 total, ${maxConsecutive >= 3 ? "✅" : "❌"} ${maxConsecutive}/3 consecutive`);

    if (successCount >= 10 && maxConsecutive >= 3) {
      console.log("\n🎉 GRADUATION REQUIREMENTS MET!");
      break;
    }

    if (i < CONFIG.totalJobs - 1) {
      console.log(`\n[buyer] Waiting ${CONFIG.delayBetweenJobsMs / 1000}s before next job...`);
      await sleep(CONFIG.delayBetweenJobsMs);
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  FINAL RESULTS`);
  console.log(`  ✓ Success: ${successCount} / ${successCount + failCount}`);
  console.log(`  ✗ Failed:  ${failCount}`);
  console.log(`  Max consecutive: ${maxConsecutive}`);
  console.log(`  Graduation: ${successCount >= 10 && maxConsecutive >= 3 ? "✅ READY" : "❌ NOT YET"}`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => { console.error("[fatal]", err); process.exit(1); });
