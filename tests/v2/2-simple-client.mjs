// v2 Test - Uses v2 API
import { MCPClientSSE } from '../client/MCPClientSSE.mjs'
import { ClientExact } from 'x402-core/v2/exact/evm'
import { ServerManager } from '../helpers/ServerManager.mjs'


const env = {
    'envPath': './../../../.env',
    'envSelection': [
        [ 'clientPrivateKey', 'ACCOUNT_DEVELOPMENT_PRIVATE_KEY' ],
        [ 'clientProviderUrl', 'BASE_SEPOLIA_ALCHEMY_HTTP' ]
    ]
}

const cfg = {
    'silent': false,
    'serverUrl': 'http://localhost:8080/x402/sse',
    'clientSupportedPaymentNetworkIdList': [ 'eip155:84532' ],
    'clientAllowedAssetConstraintList': [
        { 'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 'maxAmount': '1000000' }
    ]
}

const { envPath, envSelection } = env
const { clientSupportedPaymentNetworkIdList, clientAllowedAssetConstraintList, serverUrl, silent } = cfg

const { x402Credentials: clientCredentials, privateKey: clientPrivateKey } = ServerManager
    .getX402Credentials( { envPath, envSelection } )

const clientExact = new ClientExact( { silent } )
    .init( { providerUrl: clientCredentials.clientProviderUrl } )
await clientExact
    .setWallet( { privateKey: clientPrivateKey } )

const client = new MCPClientSSE( { serverUrl, silent } )
await client.start()


client.usePaymentHandler( async ( { originalRequest, response } ) => {
    const paymentRequiredResponsePayload = response.data
console.log( 'paymentRequiredResponsePayload', paymentRequiredResponsePayload )
    const { selectedPaymentRequirements } = ClientExact
        .selectMatchingPaymentOption( {
            paymentRequiredResponsePayload,
            clientSupportedPaymentNetworkIdList,
            clientAllowedAssetConstraintList,
            paymentOptionSelectionPolicy: null
        } )

    const { exactEvmAuthorizationPayload, exactEvmAuthorizationSignature } = await clientExact
        .createAuthorization( {
            selectedPaymentRequirements,
            exactEvmAuthorizationTimeWindowDefinition: { validAfterOffsetSeconds: -30 }
        } )

    const { paymentPayload } = ClientExact
        .createPaymentPayloadObject( {
            resource: paymentRequiredResponsePayload.resource,
            selectedPaymentRequirements,
            exactEvmAuthorizationPayload,
            exactEvmAuthorizationSignature
        } )

    const { retryResponse } = await client
        .retryRequest( { request: originalRequest, meta: { 'x402/payment': paymentPayload } } )
console.log( 'retryResponse', retryResponse )
    return retryResponse
} )

const { status: s1, data: d1 } = await client
    .callTool( { toolName: 'paid_ping_x402', args: {} } )
console.log( 'status', s1, 'data', d1[ 'result' ][ 'content' ] )

await client.close()
