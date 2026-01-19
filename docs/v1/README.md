# X402 MCP Middleware v1 (Legacy)

> **This version is frozen.** No new features will be added.
> For new projects, use [v2](../v2/README.md).

## Installation

```javascript
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

## Usage

```javascript
const middleware = await X402Middleware.create({
    chainId: 84532,
    chainName: 'Base Sepolia',
    contracts: { /* contract definitions */ },
    paymentOptions: { /* payment options */ },
    restrictedCalls: [ /* restricted tool calls */ ],
    x402Credentials: { serverProviderUrl: '...' },
    x402PrivateKey: process.env.FACILITATOR_KEY
})

app.use(middleware.mcp())
```

## Features

- Single-chain support (one chainId)
- X-PAYMENT header based payment transmission
- HTTP 402 status code for payment required

## Differences from v2

| Feature | v1 (Legacy) | v2 |
|---------|-------------|-----|
| Multi-chain | No | Yes |
| Payment transmission | X-PAYMENT header | `_meta["x402/payment"]` |
| Payment required | HTTP 402 | JSON-RPC error 402 |
| MCP spec compliant | No | Yes |
