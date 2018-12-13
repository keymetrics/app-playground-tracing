'use strict'

const express = require('express')
const {Tracer, ExplicitContext, BatchRecorder, jsonEncoder: {JSON_V2}} = require('zipkin')
const {HttpLogger} = require('zipkin-transport-http')
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware
const zipkinClientRedis = require('zipkin-instrumentation-redis')
const Redis = require('redis')

const ctxImpl = new ExplicitContext()
const tracer = new Tracer({
  supportsJoin: false, // avoid having the same span id
  ctxImpl,
  recorder: new BatchRecorder({
    logger: new HttpLogger({
      endpoint: 'https://zipkin.cloud.pm2.io/api/v2/spans',
      headers: {
        Authorization: process.env.KM_SECRET_ID
      },
      jsonEncoder: JSON_V2,
      httpInterval: 1000
    })
  }),
  port: 3000,
  localServiceName: 'app-playground'
})
const app = express()
const redisConnectionOptions = {
  host: 'localhost',
  port: '6379'
}
const redis = zipkinClientRedis(tracer, Redis, redisConnectionOptions)

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}))

app.get('/', (req, res, next) => {
  return res.send({
    name: 'playground-app'
  })
})
app.post('/api/users', (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).send({ msg: 'Unauthorized.' })
  redis.lpush('users', JSON.stringify(req.body), (err, data) => {
    if (err) return next(err)
    return res.send(data)
  })
})
app.get('/api/users', (req, res, next) => {
  redis.lrange('users', 0, -1, (err, users) => {
    if (err) return next(err)
    return res.send(users)
  })
})

app.listen(3000, _ => {
  return console.log('Listening on port 3000')
})
