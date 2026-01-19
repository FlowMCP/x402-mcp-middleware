// v1 Test - Uses Legacy API (STDIO↔SSE Proxy)

import { MCPStdioSSEProxy } from '../client/MCPStdioSSEProxy.mjs'
import { ClientExact } from 'x402-core/legacy'
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
    chainId: '84532',
    chainName: 'base-sepolia',
    allowedPaymentOptions: [
        {
            name: 'USDC',
            tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            decimals: 6,
            maxAmountRequired: '0.01'
        }
    ]
}

const silent = process.env.SILENT === 'true' || args.silent === 'true'
const bearerToken = process.env.BEARER_TOKEN || args.bearerToken || '123'
const serverUrl = process.env.SERVER_URL || args.serverUrl || 'http://localhost:8080/x402/sse'


const { envPath, envSelection } = env
const { chainId, allowedPaymentOptions } = cfg

const { x402Credentials, privateKey } = ServerManager
    .getX402Credentials({ envPath, envSelection })

const clientExact = new ClientExact({ silent })
    .init({ providerUrl: x402Credentials.clientProviderUrl })

await clientExact
    .setWallet({ privateKey, allowedPaymentOptions })


async function getPaymentHeader(originalRequest, response) {
    if (!response || typeof response !== 'object' || !Array.isArray(response.accepts)) {
        console.warn('[x402] Missing "accepts" field in response, skipping payment header generation')
        return null
    }

    const paymentRequirementsPayload = response

    const { paymentOption } = ClientExact
        .selectMatchingPaymentOption({ paymentRequirementsPayload, allowedPaymentOptions, chainId })

    const { scheme, network } = paymentOption
    const { authorization, signature } = await clientExact
        .createAuthorization({ paymentOption, allowedPaymentOptions, chainId })
    const { headerString } = clientExact
        .createXPaymentHeader({ scheme, network, authorization, signature })

    if (!silent) console.log('Generated X-PAYMENT header:', headerString)

    return headerString
}


if (!silent) {
    console.log('Starting MCP STDIO↔SSE Proxy...')
    console.log('SSE URL:', serverUrl)
    if (bearerToken) console.log('Using Bearer token')
}

const proxy = new MCPStdioSSEProxy({
    serverUrl,
    bearerToken,
    getPaymentHeader: async (...args) => {
        const header = await getPaymentHeader(...args)
        if (!header) return null
        return header
    },
    silent
})

proxy.start()
