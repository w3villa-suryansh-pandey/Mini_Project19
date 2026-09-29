require('dotenv').config()

const mongoose = require('mongoose')
const User = require('../models/User')
const connectDB = require('../config/db')
const { hashPassword } = require('../src/utils/auth.utils')

async function createAdmin() {
	const name = process.env.ADMIN_NAME?.trim()
	const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
	if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
		throw new Error('Set ADMIN_EMAIL to a valid email address.')
	}

	await connectDB()
	try {
		const existingUser = await User.findOne({ email })
		if (existingUser) {
			if (existingUser.role !== 'admin') {
				existingUser.role = 'admin'
				await existingUser.save()
			}
			console.log(`Admin access enabled for ${email}. The existing password is unchanged.`)
			return
		}

		const password = process.env.ADMIN_PASSWORD
		if (!name || name.length > 100) {
			throw new Error('Set ADMIN_NAME (up to 100 characters) to create a new admin.')
		}
		if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
			throw new Error('Set ADMIN_PASSWORD to a password between 8 and 72 characters.')
		}

		await User.create({
			name,
			email,
			password: await hashPassword(password),
			role: 'admin',
			emailVerifiedAt: new Date(),
			authProviders: { email: true },
		})
		console.log(`Admin account created for ${email}.`)
	} finally {
		await mongoose.disconnect()
	}
}

createAdmin().catch((error) => {
	console.error(`Could not create admin: ${error.message}`)
	process.exitCode = 1
})
