import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockNonceStore = jest.fn().mockImplementation( () => ( {} ) )
const mockServerExactInit = jest.fn()
const mockServerExactSetWallet = jest.fn()

const MockServerExact = jest.fn().mockImplementation( () => {
    const instance = {
        init: mockServerExactInit,
        setWallet: mockServerExactSetWallet
    }

    mockServerExactInit.mockReturnValue( instance )
    mockServerExactSetWallet.mockResolvedValue( undefined )

    return instance
} )

jest.unstable_mockModule( 'x402-core/v2/exact/evm', () => ( {
    ServerExact: MockServerExact,
    NonceStore: mockNonceStore
} ) )

const { ServerExactPool } = await import( '../../src/v2/exact/evm/serverExactPool.mjs' )


describe( 'ServerExactPool', () => {
    beforeEach( () => {
        jest.clearAllMocks()

        mockServerExactInit.mockImplementation( function() { return this } )
        mockServerExactSetWallet.mockResolvedValue( undefined )
    } )


    describe( 'init', () => {
        test( 'initializes pool with single network', async () => {
            const pool = new ServerExactPool( { silent: true } )

            const { poolSize } = await pool.init( {
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': 'http://base:8545'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': '0xkey1'
                }
            } )

            expect( poolSize ).toBe( 1 )
        } )


        test( 'initializes pool with multiple networks', async () => {
            const pool = new ServerExactPool( { silent: true } )

            const { poolSize } = await pool.init( {
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': 'http://base:8545',
                    'eip155:1': 'http://mainnet:8545'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': '0xkey1',
                    'eip155:1': '0xkey2'
                }
            } )

            expect( poolSize ).toBe( 2 )
        } )


        test( 'throws when private key is missing for network', async () => {
            const pool = new ServerExactPool( { silent: true } )

            await expect( pool.init( {
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': 'http://base:8545'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {}
            } ) ).rejects.toThrow( 'Missing facilitator private key' )
        } )
    } )


    describe( 'get', () => {
        test( 'returns serverExact for initialized network', async () => {
            const pool = new ServerExactPool( { silent: true } )

            await pool.init( {
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': 'http://base:8545'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': '0xkey1'
                }
            } )

            const { serverExact, found } = pool.get( { paymentNetworkId: 'eip155:84532' } )

            expect( found ).toBe( true )
            expect( serverExact ).toBeDefined()
        } )


        test( 'returns not found for unknown network', () => {
            const pool = new ServerExactPool( { silent: true } )

            const { serverExact, found } = pool.get( { paymentNetworkId: 'eip155:999' } )

            expect( found ).toBe( false )
            expect( serverExact ).toBeNull()
        } )
    } )


    describe( 'getNetworkIds', () => {
        test( 'returns all initialized network IDs', async () => {
            const pool = new ServerExactPool( { silent: true } )

            await pool.init( {
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': 'http://base:8545',
                    'eip155:1': 'http://mainnet:8545'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': '0xkey1',
                    'eip155:1': '0xkey2'
                }
            } )

            const { networkIds } = pool.getNetworkIds()

            expect( networkIds ).toContain( 'eip155:84532' )
            expect( networkIds ).toContain( 'eip155:1' )
            expect( networkIds ).toHaveLength( 2 )
        } )


        test( 'returns empty array before init', () => {
            const pool = new ServerExactPool( { silent: true } )
            const { networkIds } = pool.getNetworkIds()

            expect( networkIds ).toEqual( [] )
        } )
    } )
} )
