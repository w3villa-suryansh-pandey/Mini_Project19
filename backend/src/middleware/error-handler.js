function errorHandler(error, req, res, next) {
	if (res.headersSent) {
		return next(error)
	}

	const statusCode = error.status || error.statusCode || 500
	const isClientError = statusCode >= 400 && statusCode < 500
	const message = error.type === 'entity.parse.failed'
		? 'Request body contains invalid JSON'
		: isClientError
			? error.message
			: 'Internal server error'

	if (statusCode >= 500) {
		console.error(error)
	}

	res.status(statusCode).json({
		error: {
			message,
		},
	})
}

module.exports = errorHandler