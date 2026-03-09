/**
 * test-claude.ts
 *
 * Test the Claude reasoning engine standalone (no ACP needed).
 * Verifies that Claude correctly interprets jobs and picks the right endpoints.
 *
 * Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx src/test-claude.ts
 */

import "dotenv/config";
import { SpraayGatewayClient } from "./gateway-client.js";
import { ClaudeReasoningEngine } from "./claude-engine.js";

const TEST_JOBS = [
  {
    name: "Simple price lookup",
    description: "Get the current price of Ethereum in USD",
  },
  {
    name: "Multi-step: price + swap quote",
    description: "First check the ETH price, then get me a swap quote to trade 100 USDC for WETH on Base.",
  },
  {
    name: "Create an invoice",
    description: "Create a crypto invoice for 500 USDC to 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for consulting work, due in 7 days.",
  },
  {
    name: "Web search + AI inference",
    description: "Search the web for 'x402 protocol micropayments' and then summarize the results using an AI model.",
  },
  {
    name: "Ambiguous request",
    description: "I need to pay my team — 5 people, 200 USDC each, on Base. Also get me a report on my wallet 0xAd62f03C7514bb8c51f1eA70C2b75C37404695c8.",
  },
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in .env or pass inline.");
    process.exit(1);
  }

  const gatewayUrl = process.env.SPRAAY_GATEWAY_URL || "https://gateway.spraay.app";
  const gateway = new SpraayGatewayClient(gatewayUrl, process.env.X402_WALLET_PRIVATE_KEY || "");
  await gateway.init();

  const engine = new ClaudeReasoningEngine(gateway);

  console.log("\n  💧 Spraay ACP Provider — Claude Reasoning Test\n");
  console.log("=".repeat(60));

  for (const test of TEST_JOBS) {
    console.log(`\n📋 TEST: ${test.name}`);
    console.log(`   "${test.description}"`);
    console.log("   ---");

    const result = await engine.processJob(test.description);

    console.log(`   Success:   ${result.success ? "✅" : "❌"}`);
    console.log(`   Tools:     ${result.toolCallCount}`);
    console.log(`   Offerings: ${result.offeringsUsed.join(", ") || "none"}`);
    console.log(`   Cost:      $${result.totalGatewayCost.toFixed(4)}`);
    console.log(`   Summary:   ${result.summary.slice(0, 200)}${result.summary.length > 200 ? "..." : ""}`);

    for (const r of result.results) {
      console.log(`     → ${r.endpoint}: ${r.success ? "✅" : "❌"} (${r.latencyMs}ms) ${r.error || ""}`);
    }

    console.log("=".repeat(60));
  }

  console.log("\n🏁 All tests complete!\n");
}

main().catch(console.error);
