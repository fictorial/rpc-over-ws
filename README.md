A simple RPC-over-WebSockets server

## Installation

    npm i rpc-over-ws

## Usage

    require('rpc-over-ws')({
      greet: function ({name}) {
        return new Promise(resolve => resolve(`Hello, ${name || 'anon'}`))
      }
    })

---

    $ wscat -c ws://localhost:8080
    > {"id": 0, "rpc": "greet", "args": { "name": "brian" } }
    < {"id":0,"rpc":"greet","result":"Hello, brian"}

## API

    const createServer = require('rpc-over-ws')

    const { server, emitter, clients } = createServer(handlers, options)

      handlers = {
        $rpc: function (args, { server, clients, id, rpc }) -> Promise<result>
      }

      options = {
        port: int,            default: 8080
        pingTimeout: int,     default: 29000
        maxPings: int         default: 3
      }

"this" to a handler is the client WebSocket making the request.

If you wish to lookup other connected clients by some identifier,
set `this.clientId` to something unique in one of your handlers
and the client will be tracked in `clients`.

"result" must be encodable as JSON.

## Events

- 'server-ready' (server)
- 'server-error' (error))
- 'client-connect' (client)
- 'client-disconnect' (client)
- 'client-protocol-error' (client, error)
- 'client-raw-message' (client, message)
- 'client-io-error' (client, error)
- 'client-identity' (client, clientId)

## Protocol

Clients send JSON-encoded text frames of the form:

    { id: any, rpc: string, args: any }

The client creates the request `id`.

---

The request is routed to a handler.

---

The client is sent

    { id: same, rpc: same, result: any }

or

    { id: same, rpc: same, error: string }

The server matches the same request `id` so the client
can route the result/error to a client-local callback.
