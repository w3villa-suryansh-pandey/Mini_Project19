function getHealth(req, res) {
	res.json({
		status: 'ok',
		service: 'w3villa-api',
		timestamp: new Date().toISOString(),
		uptimeSeconds: Math.floor(process.uptime()),
	})
}

module.exports = { getHealth }