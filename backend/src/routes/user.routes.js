const express = require('express')
const { authenticate } = require('../middleware/authenticate')
const { downloadProfile, updateProfile, viewProfile } = require('../controllers/user.controller')

const router = express.Router()

router.use(authenticate)
router.get('/profile', viewProfile)
router.patch('/profile', updateProfile)
router.get('/profile/download', downloadProfile)

module.exports = router