import { ServerExact, NonceStore } from 'x402-core'
import { X402Gateway } from './task/X402Gateway.mjs'


class X402Middleware {
    #paymentRequirements
    #serverExact


    constructor( { paymentRequirements, serverExact } ) {
        this.#paymentRequirements = paymentRequirements
        this.#serverExact = serverExact
    }


    static async create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, serverCredentials, serverPrivateKey } ) {
        const paymentRequirements = X402Middleware
            .#mapPaymentRequirements( { chainId, chainName, contracts, paymentOptions, restrictedCalls, serverCredentials } )
        const { serverProviderUrl, privateKey } = serverCredentials
        const nonceStore = new NonceStore()
        const serverExact = new ServerExact( { nonceStore, silent: false } )
            .init( { providerUrl: serverProviderUrl } )
        await serverExact
            .setWallet( { privateKey: serverPrivateKey } )

        return new X402Middleware( { paymentRequirements, serverExact } )
    }


    mcp() {
        let middleware = X402Gateway
            .mcp( { paymentRequirements: this.#paymentRequirements, serverExact: this.#serverExact } )

        return middleware
    }


    static #mapPaymentRequirements( { chainId, chainName, contracts, paymentOptions, restrictedCalls, serverCredentials } ) {
        const paymentRequirements = new Map()
        restrictedCalls
            .forEach( ( call ) => {
                const { method, name, activePaymentOptions } = call

                const { preparedPaymentOptions } = ServerExact
                    .getPreparedPaymentOptions( { paymentOptions, activePaymentOptions, serverCredentials } )

                const { paymentRequirementsPayload } = ServerExact
                    .getPaymentRequirementsPayload( {
                        chainId,
                        chainName,
                        preparedPaymentOptions,
                        contracts,
                        resource: ''
                    } )

                if( !paymentRequirements.has( method ) ) {
                    paymentRequirements.set( method, new Map() )
                }

                paymentRequirements
                    .get( method )
                    .set( name, paymentRequirementsPayload )
            } )

        return paymentRequirements
    }
}


export { X402Middleware }