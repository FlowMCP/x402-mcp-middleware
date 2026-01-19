[![Test](https://img.shields.io/github/actions/workflow/status/FlowMCP/x402-mcp-middleware/test-on-release.yml)](https://github.com/FlowMCP/x402-mcp-middleware/actions) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

# x402-mcp-middleware

Express middleware for X402 payment-enabled MCP (Model Context Protocol) servers.

## Overview

x402-mcp-middleware provides drop-in middleware for building payment-enabled MCP servers. **v2 introduces multi-network support and MCP-spec compliance**, enabling servers to accept payments from multiple blockchains while transmitting payment data via JSON-RPC `_meta` fields.

## Key Features (v2)

- **Multi-Network Support**: Accept payments from multiple EVM chains simultaneously
- **MCP-Spec Compliant**: Uses JSON-RPC error code 402 and `_meta` for payment transmission
- **Automatic Network Routing**: Routes payments to correct network based on payload
- **EIP-3009 Authorization**: Gas-efficient, trust-minimized payment signatures
- **Simulation Before Settlement**: Optional transaction simulation before on-chain execution

## Documentation

| Document | Description |
|----------|-------------|
| [docs/index.md](./docs/index.md) | Documentation index and navigation |
| [docs/v1/README.md](./docs/v1/README.md) | Legacy v1 documentation (frozen) |
| [docs/v2/README.md](./docs/v2/README.md) | v2 documentation - Multi-network, MCP-spec compliant |

## Quick Start

### v2 - Multi-Network (recommended)

```js
import { X402Middleware } from 'x402-mcp-middleware/v2'
```

**Server Configuration (Multi-Network):**

```js
const middleware = await X402Middleware.create( {
    x402V2ExactEvmConfiguration: {
        contractCatalog: {
            'usdc-base-sepolia': {
                paymentNetworkId: 'eip155:84532',
                address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                decimals: 6,
                domainName: 'USDC',
                domainVersion: '2'
            },
            'usdc-avalanche-fuji': {
                paymentNetworkId: 'eip155:43113',
                address: '0x5425890298aed601595a70AB815c96711a31Bc65',
                decimals: 6,
                domainName: 'USDC',
                domainVersion: '2'
            }
        },
        paymentOptionCatalog: {
            'base-usdc-10k': { contractId: 'usdc-base-sepolia', amount: '10000', payTo: '{{facilitator}}' },
            'avax-usdc-10k': { contractId: 'usdc-avalanche-fuji', amount: '10000', payTo: '{{facilitator}}' }
        },
        restrictedCalls: [
            {
                method: 'tools/call',
                name: 'premium_tool',
                acceptedPaymentOptionIdList: [ 'base-usdc-10k', 'avax-usdc-10k' ]
            }
        ]
    },
    server: {
        payToAddressMap: { facilitator: '0x...' },
        providerUrlByPaymentNetworkId: {
            'eip155:84532': process.env.BASE_SEPOLIA_RPC,
            'eip155:43113': process.env.AVALANCHE_FUJI_RPC
        },
        facilitatorPrivateKeyByPaymentNetworkId: {
            'eip155:84532': process.env.FACILITATOR_KEY,
            'eip155:43113': process.env.FACILITATOR_KEY
        }
    }
} )

app.use( middleware.mcp() )
```

**MCP Protocol Flow:**

```
Client → tools/call (no payment)
Server → JSON-RPC error 402 + accepts[]

Client → tools/call + _meta["x402/payment"]
Server → Validate → Simulate → Settle
Server → result + _meta["x402/payment-response"]
```

### Legacy v1 (frozen)

```js
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

## Structure

```
x402-mcp-middleware/
  src/
    v1/                    # v1 implementation (frozen)
    v2/                    # v2 implementation (multi-network)
    legacy/                # Legacy entry point (re-exports v1)
  docs/
    index.md               # Documentation index
    v1/                    # v1 documentation
    v2/                    # v2 documentation
  tests/
    v1/                    # v1 tests
    v2/                    # v2 tests
```

## Version Support

| Version | Status | Import Path | Multi-Network | MCP-Spec |
|---------|--------|-------------|---------------|----------|
| v1 | Frozen | `x402-mcp-middleware/legacy` | No | No |
| v2 | Stable | `x402-mcp-middleware/v2` | Yes | Yes |

## Testing

```bash
# GitHub CI tests (no blockchain)
npm run test:ci

# E2E tests (requires .env)
npm run test:v2:server  # In terminal 1
npm run test:v2:client  # In terminal 2
```

## Contribution

Contributions are welcome!
If you encounter bugs, have feature suggestions, or want to improve the module, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE) file for details.
