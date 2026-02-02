import { describe, test, expect, jest } from '@jest/globals'
import { X402Settler } from '../../src/v1/task/X402Settler.mjs'


describe( 'V1 X402Settler', () => {
    const MOCK_PARSED_PAYMENT = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base-sepolia',
        payload: {
            authorization: {
                from: '0xSender',
                to: '0xPayTo',
                value: '1000000'
            },
            signature: '0xSig'
        }
    }

    const MOCK_SELECTED_REQUIREMENT = {
        scheme: 'exact',
        network: 'base-sepolia',
        payTo: '0xPayTo',
        extra: {
            domain: {
                verifyingContract: '0xUSDC'
            }
        }
    }


    test( 'settles successfully', async () => {
        const mockServerExact = {
            settleTransaction: jest.fn().mockResolvedValue( { ok: true } )
        }

        const { settlementStatus } = await X402Settler
            .settlePayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                selectedRequirement: MOCK_SELECTED_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( settlementStatus ).toBe( true )
        expect( mockServerExact.settleTransaction ).toHaveBeenCalledWith( {
            decodedPayment: MOCK_PARSED_PAYMENT,
            tokenAddress: '0xUSDC'
        } )
    } )


    test( 'returns false on settlement failure', async () => {
        const mockServerExact = {
            settleTransaction: jest.fn().mockResolvedValue( { ok: false } )
        }

        const consoleSpy = jest.spyOn( console, 'error' ).mockImplementation( () => {} )

        const { settlementStatus } = await X402Settler
            .settlePayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                selectedRequirement: MOCK_SELECTED_REQUIREMENT,
                serverExact: mockServerExact
            } )

        expect( settlementStatus ).toBe( false )

        consoleSpy.mockRestore()
    } )


    test( 'extracts verifyingContract from selectedRequirement', async () => {
        const mockServerExact = {
            settleTransaction: jest.fn().mockResolvedValue( { ok: true } )
        }

        const customRequirement = {
            ...MOCK_SELECTED_REQUIREMENT,
            extra: {
                domain: {
                    verifyingContract: '0xCustomContract'
                }
            }
        }

        await X402Settler
            .settlePayload( {
                parsedXPayment: MOCK_PARSED_PAYMENT,
                selectedRequirement: customRequirement,
                serverExact: mockServerExact
            } )

        expect( mockServerExact.settleTransaction ).toHaveBeenCalledWith( {
            decodedPayment: MOCK_PARSED_PAYMENT,
            tokenAddress: '0xCustomContract'
        } )
    } )
} )
