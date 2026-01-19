// PaymentRequired Cache for v2
// Builds and caches PaymentRequired payloads per restricted tool

import { ServerExact } from 'x402-core/v2/exact/evm'


class PaymentRequiredCache {
    #cache


    constructor() {
        this.#cache = new Map()
    }


    build( { restrictedCalls, preparedPaymentOptionCatalog, contractCatalog, resourcePrefix = 'mcp://tool/' } ) {
        restrictedCalls
            .forEach( ( call ) => {
                const { method, name, acceptedPaymentOptionIdList } = call

                const monetizedResourceDescriptor = `${resourcePrefix}${name}`

                const { paymentRequiredResponsePayload } = ServerExact
                    .getPaymentRequiredResponsePayload( {
                        monetizedResourceDescriptor,
                        acceptedPaymentOptionIdList,
                        preparedPaymentOptionCatalog,
                        contractCatalog
                    } )

                // Create nested map structure: method -> name -> payload
                if( !this.#cache.has( method ) ) {
                    this.#cache.set( method, new Map() )
                }

                this.#cache
                    .get( method )
                    .set( name, paymentRequiredResponsePayload )
            } )

        const cacheSize = this.#getCacheSize()

        return { cacheSize }
    }


    get( { method, name } ) {
        const methodCache = this.#cache.get( method )
        if( !methodCache ) {
            return { paymentRequiredPayload: null, isRestricted: false }
        }

        const paymentRequiredPayload = methodCache.get( name )
        if( !paymentRequiredPayload ) {
            return { paymentRequiredPayload: null, isRestricted: false }
        }

        return { paymentRequiredPayload, isRestricted: true }
    }


    #getCacheSize() {
        let count = 0

        this.#cache
            .forEach( ( methodMap ) => {
                count += methodMap.size
            } )

        return count
    }
}


export { PaymentRequiredCache }
