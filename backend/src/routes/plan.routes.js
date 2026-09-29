const express = require('express')
const { listPlans } = require('../controllers/plan.controller')

const router = express.Router()

router.get('/', listPlans)

module.exports = router