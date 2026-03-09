# 💧 Spraay ACP Provider v2.0

**Claude-powered crypto infrastructure agent on Virtuals Protocol ACP.**

An autonomous AI agent that receives job requests from other agents on the [Agent Commerce Protocol](https://whitepaper.virtuals.io/about-virtuals/agent-commerce-protocol-acp), uses Claude as its reasoning layer to interpret requests and select the right endpoints, then executes them against the [Spraay x402 Gateway](https://gateway.spraay.app) with automatic micropayments.

## Architecture

```
ACP Network (Butler, buyer agents)
       │ Job Request
       ▼
┌─────────────────────────────────────┐
│      Spraay ACP Provider v2.0       │
│                                     │
│  Job Handler                        │
│  ┌───────────┐   ┌──────────────┐  │
│  │  Claude AI │   │   Keyword    │  │
│  │  Reasoning │   │   Routing    │  │
│  │  (primary) │   │  (fallback)  │  │
│  └─────┬─────┘   └──────┬───────┘  │
│        └────────┬────────┘          │
│                 ▼                   │
│  ┌──────────────────────────────┐   │
│  │  x402-Enabled Gateway Client │   │
│  │  (auto micropayments via     │   │
│  │   x402-fetch + viem)         │   │
│  └──────────────┬───────────────┘   │
└─────────────────┼───────────────────┘
                  ▼
     Spraay x402 Gateway
     gateway.spraay.app
```

## What's New in v2.0

- **Claude AI reasoning** as primary job handler — interprets natural language, picks the right endpoint(s), chains multi-step calls
- **Automatic fallback** to keyword routing if Claude is unavailable
- **Multi-step job support** — "get ETH price then create a batch payment" runs as a single job
- **Stats tracking** shows Claude vs keyword job counts + revenue/cost/margin
- **Backwards compatible** — same env vars, same Railway setup, same ACP registration

## Revenue Model (3 Layers)

| Layer | Source | How |
|-------|--------|-----|
| 💧 x402 | Gateway micropayments | Auto-paid via x402-fetch per call |
| 🤝 ACP | Job fees | USDC escrowed per job |
| 🏆 aGDP | Token rewards | After token launch + graduation |

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure — add ANTHROPIC_API_KEY to your existing .env
cp .env.example .env

# 3. Test Claude reasoning (no ACP needed)
npx tsx src/test-claude.ts

# 4. Run in mock mode (simulates jobs locally)
npm run mock

# 5. Run live
npm start
```

## Environment Variables

All your existing env vars stay the same. Just add:

```
ANTHROPIC_API_KEY=sk-ant-...          # Claude reasoning (recommended)
USE_CLAUDE_REASONING=true              # Set false to disable Claude
CLAUDE_MODEL=claude-sonnet-4-20250514  # Model for reasoning
```

## 14 Live Offerings

| Tier | Price | Service | Endpoint |
|------|-------|---------|----------|
| T1 | $2.00 | Batch Payroll | /api/v1/payroll/run |
| T1 | $0.50 | Token Swap | /api/v1/swap/quote |
| T1 | $0.50 | Create Invoice | /api/v1/invoice/create |
| T1 | $0.10 | Price Feed Oracle | /api/v1/prices |
| T1 | $0.25 | AI Inference | /api/v1/ai/chat |
| T2 | $1.50 | Bridge Tokens | /api/v1/bridge/transfer |
| T2 | $1.50 | Create Escrow | /api/v1/escrow/create |
| T2 | $0.25 | Web Search | /api/v1/search/web |
| T2 | $0.25 | Wallet Analytics | /api/v1/analytics |
| T3 | $0.15 | Send Email | /api/v1/notify/send |
| T3 | $1.00 | GPU Model Run | /api/v1/gpu/run |
| T3 | $0.05 | RPC Call | /api/v1/rpc |
| T3 | $0.25 | Extract URL Content | /api/v1/search/extract |
| T3 | $0.35 | Q&A Search | /api/v1/search/qna |

## Deployment (Railway)

Your existing Railway setup works — just redeploy with the new code:

```bash
git add -A && git commit -m "v2.0: Claude-powered reasoning engine"
git push  # Railway auto-deploys
```

Add `ANTHROPIC_API_KEY` to your Railway environment variables.

## Links

- **Gateway**: https://gateway.spraay.app
- **MCP Server**: https://smithery.ai/server/@plagtech/spraay-x402-mcp
- **ACP Dashboard**: https://app.virtuals.io
- **npm**: @plagtech/spraay-x402-mcp

## License

MIT — Built by [@plag](https://warpcast.com/plag) / [plagtech](https://github.com/plagtech)
