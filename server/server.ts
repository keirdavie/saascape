import express from "express"
import http from "http"
import https from "https"
import fsp from "fs/promises"
import { initSockets } from "./init/sockets"
import { initExpressRoutes } from "./init/expressRoutes"
import { db } from "./db"
import initializeClients from "./clients/clients"
;(async () => {
  const { SSL_KEY, SSL_CERT, HOST_PORT } = process.env
  const isSSL = SSL_KEY && SSL_CERT

  const sslFiles = {
    key: isSSL && (await fsp.readFile(SSL_KEY)),
    cert: isSSL && (await fsp.readFile(SSL_CERT)),
  }

  const app = express()
  const webServer = isSSL
    ? https.createServer(sslFiles, app)
    : http.createServer(app)

  await db.init().then(async () => await db.connect())
  initSockets(webServer)
  initExpressRoutes(app)
  await initializeClients()

  webServer.listen(HOST_PORT, () => {
    console.log(`Listening on port ${HOST_PORT}`)
  })
})()
