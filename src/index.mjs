import { ServerExact, NonceStore } from 'x402-core'
import { X402Gateway } from './task/X402Gateway.mjs'


class X402Middleware {
    #paymentRequirements
    #serverExact


    constructor( { paymentRequirements, serverExact } ) {
        this.#paymentRequirements = paymentRequirements
        this.#serverExact = serverExact
    }


    static async create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } ) {
        const { status, messages } = X402Middleware
            .#validationCreate( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } )
        if( !status ) { throw new Error( `X402Middleware.create: ${ messages.join( ', ' ) }` ) }

        const paymentRequirements = X402Middleware
            .#mapPaymentRequirements( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials } )
        const { serverProviderUrl } = x402Credentials
        const nonceStore = new NonceStore()
        const serverExact = new ServerExact( { nonceStore, silent: false } )
            .init( { providerUrl: serverProviderUrl } )
        await serverExact
            .setWallet( { privateKey: x402PrivateKey } )

        return new X402Middleware( { paymentRequirements, serverExact } )
    }


    mcp() {
        let middleware = X402Gateway
            .mcp( { paymentRequirements: this.#paymentRequirements, serverExact: this.#serverExact } )

        return middleware
    }


    static #mapPaymentRequirements( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials } ) {
        const paymentRequirements = new Map()
        restrictedCalls
            .forEach( ( call ) => {
                const { method, name, activePaymentOptions } = call

                const { preparedPaymentOptions } = ServerExact
                    .getPreparedPaymentOptions( { paymentOptions, activePaymentOptions, x402Credentials } )

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


    static #validationCreate( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } ) {
        const struct = { status: false, messages: [] }

        if( chainId === undefined ) {
            struct['messages'].push( 'chainId: Is required' )
        } else if( typeof chainId !== 'number' ) {
            struct['messages'].push( 'chainId: Must be a number' )
        }

        if( chainName === undefined ) {
            struct['messages'].push( 'chainName: Is required' )
        } else if( typeof chainName !== 'string' ) {
            struct['messages'].push( 'chainName: Must be a string' )
        }

        if( contracts === undefined ) {
            struct['messages'].push( 'contracts: Is required' )
        } else if( typeof contracts !== 'object' || Array.isArray( contracts ) ) {
            struct['messages'].push( 'contracts: Must be an object' )
        }

        if( paymentOptions === undefined ) {
            struct['messages'].push( 'paymentOptions: Is required' )
        } else if( typeof paymentOptions !== 'object' || Array.isArray( paymentOptions ) ) {
            struct['messages'].push( 'paymentOptions: Must be an object' )
        }

        if( restrictedCalls === undefined ) {
            struct['messages'].push( 'restrictedCalls: Is required' )
        } else if( !Array.isArray( restrictedCalls ) ) {
            struct['messages'].push( 'restrictedCalls: Must be an array' )
        }

        if( x402Credentials === undefined ) {
            struct['messages'].push( 'x402Credentials: Is required' )
        } else if( typeof x402Credentials !== 'object' || Array.isArray( x402Credentials ) ) {
            struct['messages'].push( 'x402Credentials: Must be an object' )
        }

        if( x402PrivateKey === undefined ) {
            struct['messages'].push( 'x402PrivateKey: Is required' )
        } else if( typeof x402PrivateKey !== 'string' ) {
            struct['messages'].push( 'x402PrivateKey: Must be a string' )
        }

        if( struct['messages'].length > 0 ) {
            return struct
        }

        struct['status'] = true
        return struct
    }

}


export { X402Middleware }