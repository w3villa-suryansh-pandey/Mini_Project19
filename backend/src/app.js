const cors = require('cors')
const cookieParser = require('cookie-parser')
const express = require('express')
const passport = require('passport')
const { clientOrigins } = require('./config/env')
const errorHandler = require('./middleware/error-handler')
const notFound = require('./middleware/not-found')
const { handleStripeWebhook } = require('./controllers/payment.controller')
const apiRoutes = require('./routes/api.routes')

const app = express()

app.disable('x-powered-by')
app.use(cors({
	origin(origin, callback) {
		if (!origin || clientOrigins.includes(origin)) {
			return callback(null, true)
		}

		const error = new Error('Origin is not allowed by CORS')
		error.status = 403
		return callback(error)
	},
	credentials: true,
}))
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(cookieParser())
app.use(passport.initialize())

app.get('/', (req, res) => {
	res.json({
		name: 'W3Villa API',
		status: 'running',
		health: '/api/health',
	})
})

app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)

module.exports = app