const { port, nodeEnv } = require('./src/config/env')
const app = require('./src/app')
const connectDB = require('./config/db')
const { ensureDefaultPlans } = require('./src/services/plan.service')
const {
  ensureSubscriptionExpiryJob,
  startSubscriptionExpiryScheduler,
  stopSubscriptionExpiryScheduler,
} = require('./src/services/subscription-expiry.service')

async function startServer() {
  await connectDB()
  await ensureDefaultPlans()
  await ensureSubscriptionExpiryJob()
  startSubscriptionExpiryScheduler()

  const server = app.listen(port, () => {
    console.log(`W3Villa API listening on port ${port} (${nodeEnv})`)
  })

  function shutdown(signal) {
    console.log(`${signal} received; closing HTTP server`)
    stopSubscriptionExpiryScheduler()
    server.close((error) => {
      if (error) {
        console.error('Failed to close HTTP server cleanly', error)
        process.exitCode = 1
      }
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

startServer().catch((error) => {
  console.error('Failed to start W3Villa API', error.message)
  process.exitCode = 1
})