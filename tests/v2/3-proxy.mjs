// v2 Test - Uses v2 API (STDIO↔SSE Proxy)

import { MCPStdioSSEProxy } from '../client/MCPStdioSSEProxy.mjs'
import { ClientExact } from 'x402-core/v2/exact/evm'
import { ServerManager } from '../helpers/ServerManager.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'


const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, value] = arg.split('=')
    return [key.replace(/^--/, ''), value || true]
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const env = {
    envPath: path.resolve(__dirname, '../../../../../.env'),
    envSelection: [
        [ 'clientPrivateKey', 'ACCOUNT_DEVELOPMENT_PRIVATE_KEY' ],
        [ 'clientProviderUrl', 'BASE_SEPOLIA_ALCHEMY_HTTP' ]
    ]
}

const cfg = {
    'clientSupportedPaymentNetworkIdList': [ 'eip155:84532' ],
    'clientAllowedAssetConstraintList': [
        { 'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 'maxAmount': '1000000' }
    ]
}

const silent = process.env.SILENT === 'true' || args.silent === 'true'
const bearerToken = process.env.BEARER_TOKEN || args.bearerToken || '123'
const serverUrl = process.env.SERVER_URL || args.serverUrl || 'http://localhost:8080/x402/sse'


const { envPath, envSelection } = env
const { clientSupportedPaymentNetworkIdList, clientAllowedAssetConstraintList } = cfg

const { x402Credentials, privateKey } = ServerManager
    .getX402Credentials({ envPath, envSelection })

const clientExact = new ClientExact({ silent })
    .init({ providerUrl: x402Credentials.clientProviderUrl })

await clientExact
    .setWallet({ privateKey })


async function getPaymentMeta(originalRequest, response) {
    if (!response || typeof response !== 'object' || !Array.isArray(response.accepts)) {
        console.warn('[x402] Missing "accepts" field in response, skipping payment generation')
        return null
    }

    const paymentRequiredResponsePayload = response

    const { selectedPaymentRequirements } = ClientExact
        .selectMatchingPaymentOption({
            paymentRequiredResponsePayload,
            clientSupportedPaymentNetworkIdList,
            clientAllowedAssetConstraintList,
            paymentOptionSelectionPolicy: null
        })

    if (!selectedPaymentRequirements) {
        console.warn('[x402] No matching payment option found')
        return null
    }

    const { exactEvmAuthorizationPayload, exactEvmAuthorizationSignature } = await clientExact
        .createAuthorization({
            selectedPaymentRequirements,
            exactEvmAuthorizationTimeWindowDefinition: { validAfterOffsetSeconds: -30 }
        })

    const { paymentPayload } = ClientExact
        .createPaymentPayloadObject({
            resource: paymentRequiredResponsePayload.resource,
            selectedPaymentRequirements,
            exactEvmAuthorizationPayload,
            exactEvmAuthorizationSignature
        })

    if (!silent) console.log('[x402] Generated payment for:', selectedPaymentRequirements.network)

    return { 'x402/payment': paymentPayload }
}


if (!silent) {
    console.log('Starting MCP STDIO↔SSE Proxy (v2)...')
    console.log('SSE URL:', serverUrl)
    if (bearerToken) console.log('Using Bearer token')
}

const proxy = new MCPStdioSSEProxy({
    serverUrl,
    bearerToken,
    getPaymentMeta: async (...args) => {
        const meta = await getPaymentMeta(...args)
        if (!meta) return null
        return meta
    },
    silent
})

proxy.start()
