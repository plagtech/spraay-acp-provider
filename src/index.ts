import 'dotenv/config';
import { GameAgent } from "@virtuals-protocol/game";
import { spraayPaymentsWorker } from "./workers/spraayWorker";

// ─── Load environment variables ─────────────────────────────────
// If using dotenv: import 'dotenv/config';
// Or set GAME_API_KEY in your shell / .env before running

const API_KEY = process.env.GAME_API_KEY;
if (!API_KEY) {
  console.error("❌ GAME_API_KEY not set. Get one from https://console.game.virtuals.io/");
  process.exit(1);
}

const INTERVAL = parseInt(process.env.AGENT_INTERVAL || "60", 10);

// ─── Agent Definition ───────────────────────────────────────────
const spraayAgent = new GameAgent(API_KEY, {
  name: "Spraay",
  goal: "Provide reliable, fast, and affordable batch crypto payment services to buyer agents on the ACP marketplace. Accept jobs, execute them via the Spraay x402 gateway, and return results to earn revenue and graduate as a provider.",
  description: `Spraay is a multi-chain batch payment protocol live on 12 chains (Base, Ethereum, Arbitrum, Polygon, BNB Chain, Avalanche, Unichain, Plasma, BOB, Bittensor, Solana, Stacks).

As an ACP Provider agent, Spraay offers 5 services:
1. batch_payroll ($0.01) — Send ETH/ERC-20 to up to 200 recipients in one transaction
2. token_swap ($0.01) — Swap tokens on Base via Uniswap V3/Aerodrome
3. create_invoice ($0.01) — Generate trackable payment invoices
4. price_feed_oracle ($0.01) — Real-time token price data
5. ai_inference ($0.01) — AI completions from 93 models via BlockRun/OpenRouter

All operations flow through the Spraay x402 gateway (gateway.spraay.app). Payments settle in USDC on Base.

Spraay is revenue-first, no-token. Built by @plag (Farcaster) / @plagtech (GitHub).`,
  workers: [spraayPaymentsWorker],
});

// ─── Custom Logger ──────────────────────────────────────────────
spraayAgent.setLogger((agent: GameAgent, message: string) => {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] 💧 ${agent.name}: ${message}`);
});

// ─── Run ────────────────────────────────────────────────────────
async function main() {
  console.log("💧 Spraay ACP Provider Agent — GAME SDK v2");
  console.log(`   Gateway: ${process.env.GATEWAY_URL || "https://gateway.spraay.app"}`);
  console.log(`   Interval: ${INTERVAL}s`);
  console.log(`   API Key: ${API_KEY!.slice(0, 8)}...`);
  console.log("─".repeat(50));

  try {
    await spraayAgent.init();
    console.log("✅ Agent initialized. Starting run loop...\n");
    await spraayAgent.run(INTERVAL, { verbose: true });
  } catch (err: any) {
    console.error("❌ Agent failed:", err.message || err);
    process.exit(1);
  }
}

main();
