// v1 Test - Uses Legacy API
import { MCPClientSSE } from '../client/MCPClientSSE.mjs'
import { ClientExact } from 'x402-core/legacy'
import { ServerManager } from '../helpers/ServerManager.mjs'


const env = {
    'envPath': './../../../../.env',
    'envSelection': [
        [ 'clientPrivateKey', 'ACCOUNT_DEVELOPMENT_PRIVATE_KEY' ],
        [ 'clientProviderUrl', 'BASE_SEPOLIA_ALCHEMY_HTTP' ]
    ]
}

const cfg = {
    'silent': false,
    'serverUrl': 'http://localhost:8080/x402/sse',
    'chainId': '84532',
    'chainName': 'base-sepolia',
    'allowedPaymentOptions': [
        {
            'name': 'USDC',
            'tokenAddress': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            'decimals': 6,
            'maxAmountRequired': '0.01'
        }
    ]
}

const { envPath, envSelection } = env
const { chainId, allowedPaymentOptions, serverUrl, silent } = cfg

const { x402Credentials: clientCredentials, privateKey: clientPrivateKey } = ServerManager
    .getX402Credentials( { envPath, envSelection } )

const clientExact = new ClientExact( { silent } )
    .init( { providerUrl: clientCredentials.clientProviderUrl } )
await clientExact
    .setWallet( { privateKey: clientPrivateKey, allowedPaymentOptions } )

const client = new MCPClientSSE( { serverUrl, silent } )
await client.start()


client.usePaymentHandler( async ( { originalRequest, response } ) => {
    const paymentRequirementsPayload = response.data
console.log( 'paymentRequirementsPayload', paymentRequirementsPayload )
    const { paymentOption } = ClientExact
        .selectMatchingPaymentOption( { paymentRequirementsPayload, allowedPaymentOptions, chainId } )
    const { scheme, network } = paymentOption

    const { authorization, signature } = await clientExact
        .createAuthorization( { paymentOption, allowedPaymentOptions, chainId } )
    const { headerString } = clientExact
        .createXPaymentHeader( { scheme, network, authorization, signature } )
    const { retryResponse } = await client
        .retryRequest( { request: originalRequest, headers: { 'X-PAYMENT': headerString } } )
console.log( 'retryResponse', retryResponse )
    return retryResponse
} )

const { status: s1, data: d1 } = await client
    .callTool( { toolName: 'paid_ping_x402', args: {} } )
console.log('status', s1, 'data', d1['result']['content'] )


/*
const { status: s2, data: d2 } = await client
    .callTool( { toolName: 'free_read_cid_pinata', args: { 'cid': 'QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1'} } )
console.log('status', s2, 'data', d2['result']['content'] )
*/

await client.close()
