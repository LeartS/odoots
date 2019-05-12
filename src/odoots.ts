import * as nodefetch from 'node-fetch'
import debug = require('debug')

import * as jsonrpc from 'jsonrpc-lite'


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

class OdooError extends Error {
    name = 'OdooError'
    constructor (public odooErrorName: string, public odooErrorMessage: string) {
        super(`${odooErrorName}: ${odooErrorMessage}`)
    }
}

function buildOdooErrorFromJRPCErrorResult (jsonRpcError: any): OdooError {
    return new OdooError(jsonRpcError.data.name, jsonRpcError.data.message)
}

function findSessionCookie (setCookie: string | null): string | undefined {
    if (!setCookie) {
        return undefined
    }
    const cookieParts = setCookie.split(';')
    return cookieParts.find(cp => cp.startsWith('session_id='))
}

/**
 * Fix non-spec compliant odoo JSON-RPC responses
 *
 * According to JSON-RPC spec
 * (https://www.jsonrpc.org/specification#response_object)
 * the `result` parameter is required in sucessfull response objects.
 *
 * Odoo breaks the spec by returning response without `result` in case of
 * successfull method calls with no return value. This methods fixes
 * that by adding a fixed result value when is undefined.
 */
function patchOdooJRPCResponse (odooResponse: any) {
    if (odooResponse.result || odooResponse.error) {
        return odooResponse
    }
    return {result: '__OK__', ...odooResponse}
}

export default class Odoots {

    private fetch: typeof fetch
    public loggedUser: LoggedUser | undefined
    private sessionCookie: string | undefined
    // Incremental request id to use for JSON-RPC
    private requestId: number = 1

    constructor (private host: string, private dbname: string) {
        this.fetch = getFetchImplementation()
        this.loggedUser = undefined
    }

    /**
     * Makes a JSON-RPC 2.0 request
     *
     * Note that odoo's JSON-RPC implementation is a little strange: it ignores
     * the `method` member of the JSON-RPC request object, and uses instead
     * different endpoints for different stuff.
     *
     * Note that there are 3 levels of `methods` params,
     * do not mix them up:
     * - HTTP method (e.g. GET, POST, HEAD etc)
     * - JSON-RPC request method (ignored by odoo JSON-RPC handling)
     * - Odoo model method (e.g. update, search_read, search etc.)
     */
    private async makeJRPCRequest (path: string, params: object): Promise<any> {
        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        if (this.loggedUser) {
            headers['Cookie'] = this.sessionCookie
        }
        // Creates JSON-RPC request object according to JSON-RPC 2.0 spec
        // Odoo ignores the 'method' key so we just put `call` there.
        const jrpcBody = jsonrpc.request(this.requestId++, 'call', params)
        const response = await this.fetch(this.host + path, {
            method: 'post',
            headers: headers,
            body: JSON.stringify(jrpcBody)
        })
        const sessionCookie = findSessionCookie(response.headers.get('set-cookie'))
        if (sessionCookie) {
            this.sessionCookie = sessionCookie
        }
        const t = await response.json()
        const parsedRes = jsonrpc.parseObject(patchOdooJRPCResponse(t))
        if (parsedRes.type === 'success') {
            return parsedRes.payload.result
        } else if (parsedRes.type === 'error') {
            throw buildOdooErrorFromJRPCErrorResult(parsedRes.payload.error)
        } else if (parsedRes.type === 'invalid') {
            throw new Error('Odoo returned an invalid JSON-RPC response')
        } else {
            throw new Error('unexpected JSON-RPC response object')
        }
    }

    async login (username: string, password: string): Promise<LoggedUser> {
        const response = await this.makeJRPCRequest(
            '/web/session/authenticate',
            {
                db: this.dbname,
                login: username,
                password: password,
            }
        )
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

    /**
     * Calls method of an odoo model through JSON-RPC
     */
    async call (
        model: string,
        method: string,
        args: any[] = [],
        kwargs: object = {},
        options: {includeContext: boolean} = {includeContext: true}
    ) {
        if (!this.loggedUser) {
            throw new Error('You must be logged in to call methods')
        }
        const kwargsFull: any = {...kwargs}
        if (options.includeContext) {
            kwargsFull.context = this.loggedUser.context
        }
        return this.makeJRPCRequest('/web/dataset/call_kw', {
            model: model,
            method: method,
            args: args,
            kwargs: kwargs
        })
    }
}

module.exports = Odoots