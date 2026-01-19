// ServerExact Pool for Multi-Network
// Manages ServerExact instances per payment network

import { ServerExact, NonceStore } from 'x402-core/v2/exact/evm'


class ServerExactPool {
    #pool
    #silent


    constructor( { silent = false } = {} ) {
        this.#pool = new Map()
        this.#silent = silent
    }


    async init( { providerUrlByPaymentNetworkId, facilitatorPrivateKeyByPaymentNetworkId } ) {
        const networkIds = Object.keys( providerUrlByPaymentNetworkId )

        for( const networkId of networkIds ) {
            const providerUrl = providerUrlByPaymentNetworkId[ networkId ]
            const privateKey = facilitatorPrivateKeyByPaymentNetworkId[ networkId ]

            if( !privateKey ) {
                throw new Error( `Missing facilitator private key for network "${networkId}"` )
            }

            const nonceStore = new NonceStore()
            const serverExact = new ServerExact( { nonceStore, silent: this.#silent } )
                .init( { providerUrl } )

            await serverExact
                .setWallet( { privateKey } )

            this.#pool.set( networkId, { serverExact, nonceStore } )

            this.#log( `✅ ServerExact initialized for ${networkId}` )
        }

        const poolSize = this.#pool.size

        return { poolSize }
    }


    get( { paymentNetworkId } ) {
        const entry = this.#pool.get( paymentNetworkId )

        if( !entry ) {
            return { serverExact: null, nonceStore: null, found: false }
        }

        const { serverExact, nonceStore } = entry

        return { serverExact, nonceStore, found: true }
    }


    getNetworkIds() {
        const networkIds = Array.from( this.#pool.keys() )

        return { networkIds }
    }


    #log( message ) {
        if( !this.#silent ) {
            console.log( message )
        }
    }
}


export { ServerExactPool }
