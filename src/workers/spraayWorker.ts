import { GameWorker } from "@virtuals-protocol/game";
import {
  batchPayroll,
  tokenSwap,
  createInvoice,
  priceFeedOracle,
  aiInference,
} from "../functions/spraayFunctions";

export const spraayPaymentsWorker = new GameWorker({
  id: "spraay_payments_worker",
  name: "Spraay Payments Worker",
  description: `Spraay Payments Worker handles all payment-related operations via the Spraay x402 gateway.

Capabilities:
- batch_payroll: Send ETH or ERC-20 tokens to up to 200 recipients in a single transaction across 12 chains
- token_swap: Swap tokens on Base via Uniswap V3 / Aerodrome routing
- create_invoice: Generate payment invoices with tracking
- price_feed_oracle: Real-time price data for any token
- ai_inference: AI completions via 93 models (BlockRun + OpenRouter)

All paid operations settle via x402 USDC micropayments on Base.`,
  functions: [
    batchPayroll,
    tokenSwap,
    createInvoice,
    priceFeedOracle,
    aiInference,
  ],
});
