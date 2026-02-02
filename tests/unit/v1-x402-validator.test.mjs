import { describe, test, expect, jest } from '@jest/globals'
import { X402Validator } from '../../src/v1/task/X402Validator.mjs'


describe( 'V1 X402Validator', () => {
    const MOCK_PARSED_PAYMENT = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base-sepolia',
        payload: {
            authorization: {
                from: '0xSender',
                to: '0xPayTo',
                value: '1000000',
                validAfter: 0,
                validBefore: 9999999999,
                nonce: '0xabc123'
            },
            signature: '0xSig123'
        }
    }

    const MOCK_PAYMENT_REQUIREMENT = {
        x402Version: 1,
        accepts: [
            {
                scheme: 'exact',
                network: 'base-sepolia',
                payTo: '0xPayTo',
                maxAmountRequired: '1.00',
                extra: {
                    domain: {
                        verifyingContract: '0xUSDC'
                    }
                }
            }
        ]
    }

    const MOCK_SELECTED_REQUIREMENT = {
        scheme: 'exact',
        network: 'base-sepolia',
        payTo: '0xPayTo',
        maxAmountRequired: '1.00',
        extra: {
            domain: {
                verifyingContract: '0xUSDC'
            }
        }
    }


    test( 'returns valid when all checks pass', async () => {
        const mockServerExact = {
            findMatchingPaymentRequirements: jest.fn().mockReturnValue( { selectedRequirement: MOCK_SELECTED_REQUIREMENT } ),
            validatePayment: jest.fn().mockResolvedValue( { ok: true } ),
            simulateTransaction: jest.fn().mockResolvedValue( { ok: true } )
        }

        const { valid, selectedRequirement } = await X402Validator
            .verifyPayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                paymentRequirement: MOCK_PAYMENT_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( valid ).toBe( true )
        expect( selectedRequirement ).toBe( MOCK_SELECTED_REQUIREMENT )
    } )


    test( 'returns ERR_INVALID_SCHEMA when no matching requirement found', async () => {
        const mockServerExact = {
            findMatchingPaymentRequirements: jest.fn().mockReturnValue( { selectedRequirement: null } )
        }

        const { valid, errorCode } = await X402Validator
            .verifyPayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                paymentRequirement: MOCK_PAYMENT_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( valid ).toBe( false )
        expect( errorCode ).toBe( 'ERR_INVALID_SCHEMA' )
    } )


    test( 'returns ERR_SIGNATURE_INVALID when validation fails', async () => {
        const mockServerExact = {
            findMatchingPaymentRequirements: jest.fn().mockReturnValue( { selectedRequirement: MOCK_SELECTED_REQUIREMENT } ),
            validatePayment: jest.fn().mockResolvedValue( { ok: false } )
        }

        const { valid, errorCode } = await X402Validator
            .verifyPayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                paymentRequirement: MOCK_PAYMENT_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( valid ).toBe( false )
        expect( errorCode ).toBe( 'ERR_SIGNATURE_INVALID' )
    } )


    test( 'returns ERR_SIMULATION_FAILED when simulation fails', async () => {
        const mockServerExact = {
            findMatchingPaymentRequirements: jest.fn().mockReturnValue( { selectedRequirement: MOCK_SELECTED_REQUIREMENT } ),
            validatePayment: jest.fn().mockResolvedValue( { ok: true } ),
            simulateTransaction: jest.fn().mockResolvedValue( { ok: false } )
        }

        const { valid, errorCode } = await X402Validator
            .verifyPayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                paymentRequirement: MOCK_PAYMENT_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( valid ).toBe( false )
        expect( errorCode ).toBe( 'ERR_SIMULATION_FAILED' )
    } )


    test( 'returns ERR_INTERNAL_VALIDATION_ERROR on exception', async () => {
        const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} )

        const mockServerExact = {
            findMatchingPaymentRequirements: jest.fn().mockImplementation( () => { throw new Error( 'Network error' ) } )
        }

        const { valid, errorCode } = await X402Validator
            .verifyPayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                paymentRequirement: MOCK_PAYMENT_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( valid ).toBe( false )
        expect( errorCode ).toBe( 'ERR_INTERNAL_VALIDATION_ERROR' )

        consoleSpy.mockRestore()
    } )
} )
