// x402-mcp-middleware Root Exports
// Breaking Change: Use explicit version imports
//
// v1/Legacy: import { X402Middleware } from 'x402-mcp-middleware/legacy'
// v2:        import { X402Middleware } from 'x402-mcp-middleware/v2'

export * as v1 from './v1/index.mjs'
export * as v2 from './v2/index.mjs'
export * as legacy from './legacy/index.mjs'
