import {
  GameFunction,
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
} from "@virtuals-protocol/game";
import fetch from "node-fetch";

const GATEWAY = process.env.GATEWAY_URL || "https://gateway.spraay.app";

// ─── 1. Batch Payroll ────────────────────────────────────────────
export const batchPayroll = new GameFunction({
  name: "batch_payroll",
  description:
    "Execute batch crypto payroll — send tokens to multiple recipients in a single transaction on Base. Requires token symbol/address, arrays of recipient addresses and amounts, and a sender address.",
  args: [
    {
      name: "token",
      description:
        'Token to send. Use "USDC", "ETH", or a contract address for any ERC-20.',
    },
    {
      name: "recipients",
      description:
        'JSON stringified array of recipient wallet addresses: ["0xabc...", "0xdef..."]. Max 200.',
    },
    {
      name: "amounts",
      description:
        'JSON stringified array of amounts (in smallest unit / wei): ["1000000", "2000000"]. Must match recipients length.',
    },
    {
      name: "sender",
      description: "Sender wallet address (0x...)",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const recipients = JSON.parse(args.recipients || "[]");
      const amounts = JSON.parse(args.amounts || "[]");
      if (recipients.length === 0) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          "No recipients provided"
        );
      }
      logger(
        `Executing batch payroll: ${recipients.length} recipients, token=${args.token || "USDC"}`
      );

      const res = await fetch(`${GATEWAY}/api/v1/batch/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: args.token || "USDC",
          recipients,
          amounts,
          sender: args.sender,
        }),
      });
      const data = await res.json();

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(data)
      );
    } catch (e: any) {
      logger(`batch_payroll error: ${e.message}`);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Batch payroll failed: ${e.message}`
      );
    }
  },
});

// ─── 2. Token Swap ───────────────────────────────────────────────
export const tokenSwap = new GameFunction({
  name: "token_swap",
  description:
    "Get a swap quote for tokens on Base via Uniswap V3 routing. Returns the expected output amount for a given input.",
  args: [
    {
      name: "token_in",
      description:
        'Input token symbol or address (e.g. "USDC", "WETH", or contract address)',
    },
    {
      name: "token_out",
      description:
        'Output token symbol or address (e.g. "WETH", "DAI", or contract address)',
    },
    {
      name: "amount_in",
      description: "Amount of input token in smallest unit (e.g. '1000000' for 1 USDC)",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      logger(
        `Token swap quote: ${args.amount_in} ${args.token_in} → ${args.token_out}`
      );

      const params = new URLSearchParams({
        tokenIn: args.token_in || "USDC",
        tokenOut: args.token_out || "WETH",
        amountIn: args.amount_in || "1000000",
      });

      const res = await fetch(`${GATEWAY}/api/v1/swap/quote?${params}`);
      const data = await res.json();

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(data)
      );
    } catch (e: any) {
      logger(`token_swap error: ${e.message}`);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Token swap failed: ${e.message}`
      );
    }
  },
});

// ─── 3. Create Invoice ──────────────────────────────────────────
export const createInvoice = new GameFunction({
  name: "create_invoice",
  description:
    "Create a payment invoice for a specific amount and token. Returns an invoice ID and details that can be shared with the payer.",
  args: [
    {
      name: "amount",
      description: "Invoice amount as string (e.g. '100.00')",
    },
    {
      name: "token",
      description: 'Token for payment (e.g. "USDC", "ETH")',
    },
    {
      name: "memo",
      description: "Description or memo for the invoice (e.g. 'March consulting fee')",
    },
    {
      name: "recipient",
      description: "Wallet address of the invoice recipient (who gets paid)",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      logger(
        `Creating invoice: ${args.amount} ${args.token} → ${args.recipient}`
      );

      const res = await fetch(`${GATEWAY}/api/v1/invoice/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: args.amount,
          token: args.token || "USDC",
          memo: args.memo || "",
          recipient: args.recipient,
        }),
      });
      const data = await res.json();

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(data)
      );
    } catch (e: any) {
      logger(`create_invoice error: ${e.message}`);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Invoice creation failed: ${e.message}`
      );
    }
  },
});

// ─── 4. Price Feed Oracle ───────────────────────────────────────
export const priceFeedOracle = new GameFunction({
  name: "price_feed_oracle",
  description:
    "Get real-time price data for cryptocurrencies. Returns current prices for the requested tokens.",
  args: [
    {
      name: "tokens",
      description:
        'Comma-separated token symbols to look up (e.g. "ETH,BTC,STX,USDC")',
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const tokens = args.tokens || "ETH";
      logger(`Price oracle: ${tokens}`);

      const params = new URLSearchParams({ tokens });
      const res = await fetch(`${GATEWAY}/api/v1/oracle/prices?${params}`);
      const data = await res.json();

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(data)
      );
    } catch (e: any) {
      logger(`price_feed_oracle error: ${e.message}`);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Price feed failed: ${e.message}`
      );
    }
  },
});

// ─── 5. AI Inference ─────────────────────────────────────────────
export const aiInference = new GameFunction({
  name: "ai_inference",
  description:
    "Run AI chat completions via 200+ models (OpenAI, Anthropic, Meta, Mistral, etc). Submit messages and receive a completion response.",
  args: [
    {
      name: "model",
      description:
        'Model to use. Default "openai/gpt-4o-mini". Examples: "openai/gpt-4o", "anthropic/claude-3.5-sonnet", "meta/llama-3.1-70b".',
    },
    {
      name: "message",
      description: "The user message / prompt to send to the AI model",
    },
  ] as const,
  executable: async (args, logger) => {
    try {
      const model = args.model || "openai/gpt-4o-mini";
      logger(`AI inference: model=${model}`);

      const res = await fetch(`${GATEWAY}/api/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: args.message || "Hello" }],
        }),
      });
      const data = await res.json();

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        JSON.stringify(data)
      );
    } catch (e: any) {
      logger(`ai_inference error: ${e.message}`);
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `AI inference failed: ${e.message}`
      );
    }
  },
});
