import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockGetPaymentRequiredResponsePayload = jest.fn()

jest.unstable_mockModule( 'x402-core/v2/exact/evm', () => ( {
    ServerExact: {
        getPaymentRequiredResponsePayload: mockGetPaymentRequiredResponsePayload
    }
} ) )

const { PaymentRequiredCache } = await import( '../../src/v2/exact/evm/PaymentRequiredCache.mjs' )


describe( 'PaymentRequiredCache', () => {
    const MOCK_PAYLOAD_WEATHER = {
        x402Version: 2,
        accepts: [ { scheme: 'exact', network: 'eip155:84532' } ]
    }

    const MOCK_PAYLOAD_SEARCH = {
        x402Version: 2,
        accepts: [ { scheme: 'exact', network: 'eip155:1' } ]
    }


    beforeEach( () => {
        mockGetPaymentRequiredResponsePayload.mockReset()
    } )


    describe( 'build', () => {
        test( 'builds cache from restricted calls', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValue( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )

            const cache = new PaymentRequiredCache()
            const { cacheSize } = cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [ 'opt-1' ] }
                ],
                preparedPaymentOptionCatalog: {},
                contractCatalog: {},
                resourcePrefix: 'mcp://tool/'
            } )

            expect( cacheSize ).toBe( 1 )
            expect( mockGetPaymentRequiredResponsePayload ).toHaveBeenCalledTimes( 1 )
        } )


        test( 'passes correct monetizedResourceDescriptor', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValue( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )

            const cache = new PaymentRequiredCache()
            cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [ 'opt-1' ] }
                ],
                preparedPaymentOptionCatalog: { catalog: true },
                contractCatalog: { contracts: true },
                resourcePrefix: 'mcp://tool/'
            } )

            expect( mockGetPaymentRequiredResponsePayload ).toHaveBeenCalledWith( {
                monetizedResourceDescriptor: 'mcp://tool/get_weather',
                acceptedPaymentOptionIdList: [ 'opt-1' ],
                preparedPaymentOptionCatalog: { catalog: true },
                contractCatalog: { contracts: true }
            } )
        } )


        test( 'handles multiple restricted calls', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValueOnce( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )
                .mockReturnValueOnce( { paymentRequiredResponsePayload: MOCK_PAYLOAD_SEARCH } )

            const cache = new PaymentRequiredCache()
            const { cacheSize } = cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [ 'opt-1' ] },
                    { method: 'tools/call', name: 'search_web', acceptedPaymentOptionIdList: [ 'opt-2' ] }
                ],
                preparedPaymentOptionCatalog: {},
                contractCatalog: {}
            } )

            expect( cacheSize ).toBe( 2 )
        } )


        test( 'groups by method', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValueOnce( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )
                .mockReturnValueOnce( { paymentRequiredResponsePayload: MOCK_PAYLOAD_SEARCH } )

            const cache = new PaymentRequiredCache()
            cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [] },
                    { method: 'resources/read', name: 'secret_doc', acceptedPaymentOptionIdList: [] }
                ],
                preparedPaymentOptionCatalog: {},
                contractCatalog: {}
            } )

            const weatherResult = cache.get( { method: 'tools/call', name: 'get_weather' } )
            const docResult = cache.get( { method: 'resources/read', name: 'secret_doc' } )

            expect( weatherResult.isRestricted ).toBe( true )
            expect( docResult.isRestricted ).toBe( true )
        } )
    } )


    describe( 'get', () => {
        test( 'returns payload for restricted tool', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValue( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )

            const cache = new PaymentRequiredCache()
            cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [] }
                ],
                preparedPaymentOptionCatalog: {},
                contractCatalog: {}
            } )

            const { paymentRequiredPayload, isRestricted } = cache.get( { method: 'tools/call', name: 'get_weather' } )

            expect( isRestricted ).toBe( true )
            expect( paymentRequiredPayload ).toEqual( MOCK_PAYLOAD_WEATHER )
        } )


        test( 'returns null for unknown method', () => {
            const cache = new PaymentRequiredCache()

            const { paymentRequiredPayload, isRestricted } = cache.get( { method: 'unknown/method', name: 'test' } )

            expect( isRestricted ).toBe( false )
            expect( paymentRequiredPayload ).toBeNull()
        } )


        test( 'returns null for unknown tool name', () => {
            mockGetPaymentRequiredResponsePayload
                .mockReturnValue( { paymentRequiredResponsePayload: MOCK_PAYLOAD_WEATHER } )

            const cache = new PaymentRequiredCache()
            cache.build( {
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [] }
                ],
                preparedPaymentOptionCatalog: {},
                contractCatalog: {}
            } )

            const { paymentRequiredPayload, isRestricted } = cache.get( { method: 'tools/call', name: 'unknown_tool' } )

            expect( isRestricted ).toBe( false )
            expect( paymentRequiredPayload ).toBeNull()
        } )
    } )
} )
