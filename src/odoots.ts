import * as nodefetch from 'node-fetch'
import debug = require('debug')


const debugHTTP = debug('odoots:http')

/**
 * Returns the "fetch" implementation for the current environment:
 *
 * nodejs: node-fetch library
 * good / updated browsers: the native "fetch" built-in global fetch impolementation
 * old / bad browsers with no fetch implementation: unsupported
 */
function getFetchImplementation (): typeof fetch {
    if (typeof window === 'undefined') {
        try {
            const fetchImpl: typeof fetch = require('node-fetch')
            return fetchImpl
        } catch (err) {
            throw new Error('You have to install "node-fetch" to use odoots in nodejs')
        }
    }
    if (typeof fetch === 'undefined') {
        throw new Error('You are using an unsupported browser version (no fetch implementation)')
    }
    return fetch
}

export interface OdooJSONRPCErrorDetails {
    name: string
    message: string
    type: string
    debug?: string
}

export class OdooRPCError extends Error {
    public odooErrorName: string
    public type: string
    public debug?: string
    constructor (errorDetails: OdooJSONRPCErrorDetails) {
        super(errorDetails.message)
        this.name = 'OdooRPCError'
        this.type = errorDetails.type
        this.odooErrorName = errorDetails.name
        this.debug = errorDetails.debug
    }
}

export class AuthenticationError extends Error {
    constructor (message?: string) {
        super(message)
    }
}

export interface UserContext {
    lang: string
    tz: string
    uid: number
}

export interface LoggedUser {
    uid: number
    username: string
    sessionId: string
    partnerId: number
    name: string
    isAdmin: boolean
    isSuperuser: boolean
    companyId: number
    context: UserContext
}

export default class Odoots {

    private fetch: typeof fetch
    public loggedUser: LoggedUser | undefined

    constructor (private host: string, private dbname: string) {
        this.fetch = getFetchImplementation()
        this.loggedUser = undefined
    }

    private async jrpcCall (path: string, data: any): Promise<any> {
        const response = await this.fetch(this.host + path, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(data),
        })
        let jrpcResponse = await response.json()
        if (jrpcResponse.error) {
            throw new OdooRPCError({
                message: `${jrpcResponse.error.message}: ${jrpcResponse.error.data.message}`,
                type: jrpcResponse.error.data.exception_type,
                name: jrpcResponse.error.data.name,
                debug: jrpcResponse.error.data.debug,
            })
        }
        return jrpcResponse.result
    }


    async login (username: string, password: string): Promise<LoggedUser> {
        const response = await this.jrpcCall('/web/session/authenticate', {
            params: {
                db: this.dbname,
                login: username,
                password: password,
            }
        })
        // In Odoo 10 invalid credentials don't return any kind of error,
        // just unset user values.
        if (!response.uid) {
            throw new AuthenticationError('Incorrect credentials')
        }
        this.loggedUser = {
            uid: response.uid,
            partnerId: response.partner_id,
            sessionId: response.session_id,
            companyId: response.company_id,
            name: response.name,
            username: response.username,
            isAdmin: response.is_admin,
            isSuperuser: response.is_superuser,
            context: {
                lang: response.user_context.lang,
                tz: response.user_context.tz,
                uid: response.user_context.uid,
            }

        }
        return this.loggedUser
    }

}

module.exports = Odoots