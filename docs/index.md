# x402-mcp-middleware Documentation Index

## Quick Navigation

| Document | Description |
|----------|-------------|
| [Root README](../README.md) | Project overview and quick start |
| [v1 Documentation](./v1/README.md) | Legacy v1 (single-chain) - frozen |
| [v2 Documentation](./v2/README.md) | v2 (multi-network, MCP-spec compliant) |

## Version Overview

### v1 (Legacy - Frozen)

The original implementation supporting:
- Single-chain support (one chainId)
- `X-PAYMENT` header based payment transmission
- HTTP 402 status code for payment required

**Import:**
```js
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

### v2 (Current)

The MCP-spec-compliant implementation featuring:
- Multi-network support (multiple chains simultaneously)
- Payment via `_meta["x402/payment"]` in JSON-RPC
- JSON-RPC error code 402 for payment required
- Automatic network routing based on payment payload

**Import:**
```js
import { X402Middleware } from 'x402-mcp-middleware/v2'
```

## Directory Structure

```
x402-mcp-middleware/
  src/
    v1/                    # v1 implementation
    v2/                    # v2 implementation (multi-network)
    legacy/                # Legacy entry point (re-exports v1)
  docs/
    v1/README.md          # v1 docs
    v2/README.md          # v2 docs
    index.md              # This file
  tests/
    v1/                    # v1 tests
    v2/                    # v2 tests
```

## Related Projects

- [x402-core](https://github.com/FlowMCP/x402-core) - Core x402 payment library (used by this middleware)
- [MCP Specification](https://spec.modelcontextprotocol.io/) - Model Context Protocol specification
