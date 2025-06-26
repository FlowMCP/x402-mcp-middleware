import { SchemaImporter } from 'schemaImporter'
import fs from 'fs'


const config = {
    'env': {
        'development': './../../.env',
        'production': './../.env'
    },
    'schemas': {
        'development': './../../../schemas/v1.2.0/',
        'production': './../../../schemas/v1.2.0/'
    }
}


class ServerManager {
    static getEnvObject( { envPath } ) {
        const envObject = this
            .#loadEnv( { envPath } )
            .split( "\n" )
            .filter( line => line && !line.startsWith( '#' ) && line.includes( '=' ) )
            .map( line => line.split( '=' ) )
            .reduce( ( acc, [ k, v ] ) => {
                acc[ k ] = v.trim()
                return acc
            }, {} )

        return { envObject }
    }


    static getX402Credentials( { envPath, envSelection } ) {
        const rawEnv = this
            .#loadEnv( { envPath} )
            .split( "\n" )
            .filter( line => line && !line.startsWith( '#' ) && line.includes( '=' ) )
            .map( line => line.split( '=' ) )
            .reduce( ( acc, [ k, v ] ) => {
                acc[ k ] = v.trim()
                return acc
            }, {} )

        const messages = []
        const selection = envSelection
            .reduce( ( acc, select ) => {
                const [ varName, envKey ] = select
                if( Array.isArray( envKey ) ) {
                    acc[ varName ] = envKey
                        .map( key => {
                            const item = rawEnv[ key ]
                            if ( item === undefined ) {
                                messages.push( `Missing environment variable: ${key}` )
                            }
                            return item
                        } )
                } else {
                    acc[ varName ] = rawEnv[ envKey ]
                }
                return acc
            }, {} )

        if( messages.length > 0 ) {
            throw new Error( `Environment loading failed: ${ messages.join( ', ' ) }` )
        }

        const { x402Credentials, privateKey } = Object
            .entries( selection )
            .reduce( ( acc, [ key, value ] ) => {
                if( key.toLowerCase().includes( 'privatekey' ) ) {
                    if( acc['privateKey'] !== null ) { console.warn( `Multiple private keys found, using the first one` ); return acc }
                    acc['privateKey'] = value
                } else {
                    acc['x402Credentials'][ key ] = value
                }
                return acc
            }, { 'x402Credentials': {}, 'privateKey': null } )

        return { x402Credentials, privateKey }
    }


    static getPackageVersion() {
        const { version: managerVersion } = JSON.parse( fs.readFileSync( './package.json', 'utf-8' ) )
        console.log( `Manager version: ${managerVersion}` )
        return { managerVersion }
    }


    static async getArrayOfSchemas( { schemaPath } ) {
        const arrayOfSchemas = await SchemaImporter
            .loadFromFolder( {
                schemaRootFolder: schemaPath,
                excludeSchemasWithImports: false,
                excludeSchemasWithRequiredServerParams: false,
                addAdditionalMetaData: false,
                outputType: 'onlySchema'
            } )

        return { arrayOfSchemas }
    }
    

    static #loadEnv( { envPath } ) {
        if( !envPath ) {
            console.error( `No environment file found for stage type: ${stageType}` )
            return false
        }

        const envFile = fs
            .readFileSync( envPath, 'utf-8' )
        return envFile
    }
}


export { ServerManager }