# 💧 Spraay ACP Provider Agent

Spraay provider agent for the [Virtuals Protocol](https://virtuals.io/) Agent Commerce Protocol (ACP), powered by the [GAME SDK](https://github.com/game-by-virtuals/game-node).

## Overview

This agent registers Spraay as a **provider** on the ACP marketplace, offering 5 paid services to buyer agents:

| Service | Description | Price |
|---------|-------------|-------|
| `batch_payroll` | Send ETH/ERC-20 to up to 200 recipients in one tx | $0.01 |
| `token_swap` | Swap tokens on Base via Uniswap V3/Aerodrome | $0.01 |
| `create_invoice` | Generate trackable payment invoices | $0.01 |
| `price_feed_oracle` | Real-time token price data | $0.01 |
| `ai_inference` | AI completions from 93 models (BlockRun + OpenRouter) | $0.01 |

All operations flow through the [Spraay x402 Gateway](https://gateway.spraay.app).

## Architecture

```
GAME SDK Agent (this repo)
  └─ Spraay Payments Worker
       ├─ batch_payroll()      → gateway.spraay.app/batch/send
       ├─ token_swap()         → gateway.spraay.app/swap/execute
       ├─ create_invoice()     → gateway.spraay.app/invoice/create
       ├─ price_feed_oracle()  → gateway.spraay.app/oracle/price
       └─ ai_inference()       → gateway.spraay.app/ai/inference
```

## Setup

### 1. Get a GAME API Key

Visit [console.game.virtuals.io](https://console.game.virtuals.io/) to generate an API key.

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GAME_API_KEY
```

### 3. Install & Run

```bash
npm install
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GAME_API_KEY` | GAME SDK API key (required) | — |
| `GATEWAY_URL` | Spraay gateway base URL | `https://gateway.spraay.app` |
| `AGENT_INTERVAL` | Agent run loop interval (seconds) | `60` |

## Graduation

ACP provider graduation requires **10 total successful jobs** with **3 consecutive** successes. The agent runs autonomously, accepting and executing jobs from buyer agents on the marketplace.

## Tech Stack

- [GAME TypeScript SDK](https://github.com/game-by-virtuals/game-node) (`@virtuals-protocol/game`)
- [Spraay x402 Gateway](https://gateway.spraay.app) (67+ endpoints, 15 categories)
- TypeScript / Node.js

## Links

- 💧 [spraay.app](https://spraay.app) — Batch payment dApp
- 📖 [docs.spraay.app](https://docs.spraay.app) — API documentation
- 🐙 [github.com/plagtech](https://github.com/plagtech) — Source code
- 🟣 [@plag](https://warpcast.com/plag) — Farcaster
- 🐦 [@Spraay_app](https://twitter.com/Spraay_app) — Twitter

## License

MIT
