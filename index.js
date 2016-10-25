const EventEmitter = require('events')
const WebSocketServer = require('ws').Server
const _ = require('lodash')

function createServer(handlers, options = { port: 8080 }) {
  if (_.isEmpty(handlers) || !_.isObject(handlers))
    throw new Error('invalid handlers')

  const emitter = new EventEmitter()

  const clients = {}

  const server = new WebSocketServer({
    port: options.port,
    clientTracking: false,
    perMessageDeflate: false
  })

  server.on('listening', () => emitter.emit('server-ready', server))

  server.on('connection', client => {
    emitter.emit('client-connect', client)

    client.on('message', message => {
      try {
        message = JSON.parse(message)
      } catch (error) {
        emitter.emit('client-protocol-error', client, error)
        client.close()
        return
      }

      emitter.emit('client-raw-message', client, message)

      const id = message.id
      const rpc = _.trim(message.rpc || '')
      const args = message.args || {}

      if (!_.has(handlers, rpc)) {
        emitter.emit('client-protocol-error', client, new Error('unknown-rpc'))
        client.close()
        return
      }

      const handler = _.get(handlers, rpc)
      const hadClientId = _.has(client, 'clientId')

      const ret = handler.call(client, args, { server, clients, id, rpc })

      if (ret instanceof Promise) {
        ret.then(result => {
          if (!hadClientId) {
            if (_.has(client, 'clientId')) {
              clients[client.clientId] = client
              emitter.emit('client-identity', client, client.clientId)
            }
          }

          if (result) {
            const payload = { rpc, result }
            if (!_.isUndefined(message.id))
              payload.id = message.id

            client.send(JSON.stringify(payload), error => {
              if (error) {
                emitter.emit('client-io-error', client, error)
                client.close()
              }
            })
          }
        })
        .catch(error => {
          const payload = { rpc, result }
          if (!_.isUndefined(message.id))
            payload.id = message.id

          client.send(JSON.stringify(payload), error => {
            if (error) {
              emitter.emit('client-io-error', client, error)
              client.close()
            }
          })
        })
      }
    })

    const pingTimeout = Math.max(1000, options.pingTimeout || 29000)
    const maxPings = Math.max(1, options.maxPings || 3)
    var pings = 0
    var pingInterval = setInterval(() => {
      if (++pings >= maxPings) {
        emitter.emit('client-io-error', client)
        client.close()
      } else {
        client.ping()
      }
    }, pingTimeout)
    client.on('pong', () => pings = 0)

    client.once('close', () => {
      clearInterval(pingInterval)
      emitter.emit('client-disconnect', client)
      delete clients[client.clientId]
    })

    client.once('error', error => {
      emitter.emit('client-io-error', client, error)
      client.close()
    })

  })

  server.on('error', error => emitter.emit('server-error', error))

  return { server, emitter, clients }
}

module.exports = createServer
