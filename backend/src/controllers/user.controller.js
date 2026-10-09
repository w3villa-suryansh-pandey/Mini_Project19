const PDFDocument = require('pdfkit')
const User = require('../../models/User')

const PROFILE_FIELDS = ['name', 'email', 'phone', 'address', 'company', 'jobTitle', 'bio', 'profilePicture']

function respondWithError(res, status, code, message) {
	return res.status(status).json({ error: { code, message } })
}

function profileData(user) {
	return {
		id: user._id.toString(),
		name: user.name,
		email: user.email,
		phone: user.phone || '',
		address: user.address || '',
		company: user.company || '',
		jobTitle: user.jobTitle || '',
		bio: user.bio || '',
		profilePicture: user.profilePicture || '',
		googleLinked: Boolean(user.googleId),
		facebookLinked: Boolean(user.facebookId),
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	}
}

async function viewProfile(req, res) {
	const user = await User.findById(req.user._id)
		.select('_id name email phone address company jobTitle bio profilePicture googleId facebookId createdAt updatedAt')
		.lean()

	if (!user) {
		return respondWithError(res, 404, 'USER_NOT_FOUND', 'The account could not be found.')
	}

	return res.json({ profile: profileData(user) })
}

async function updateProfile(req, res) {
	const updates = {}
	for (const field of PROFILE_FIELDS) {
		if (Object.hasOwn(req.body || {}, field)) updates[field] = req.body[field]
	}
	if (Object.keys(updates).length === 0) {
		return respondWithError(res, 400, 'EMPTY_PROFILE', 'Provide at least one profile field to update.')
	}

	for (const field of ['name', 'email', 'phone', 'address', 'company', 'jobTitle', 'bio', 'profilePicture']) {
		if (Object.hasOwn(updates, field) && typeof updates[field] !== 'string') {
			return respondWithError(res, 400, 'INVALID_PROFILE', `${field} must be text.`)
		}
	}

	if (Object.hasOwn(updates, 'name')) {
		updates.name = updates.name.trim()
		if (!updates.name || updates.name.length > 100) {
			return respondWithError(res, 400, 'INVALID_PROFILE', 'Name is required and must be 100 characters or fewer.')
		}
	}
	if (Object.hasOwn(updates, 'email')) {
		updates.email = updates.email.trim().toLowerCase()
		if (!/^\S+@\S+\.\S+$/.test(updates.email)) {
			return respondWithError(res, 400, 'INVALID_PROFILE', 'Enter a valid email address.')
		}
	}
	const maxLengths = { phone: 40, address: 240, company: 120, jobTitle: 120, bio: 240 }
	for (const [field, maxLength] of Object.entries(maxLengths)) {
		if (Object.hasOwn(updates, field)) {
			updates[field] = updates[field].trim()
			if (updates[field].length > maxLength) {
				return respondWithError(res, 400, 'INVALID_PROFILE', `${field} must be ${maxLength} characters or fewer.`)
			}
		}
	}
	if (Object.hasOwn(updates, 'profilePicture') && updates.profilePicture.length > 4_200_000) {
		return respondWithError(res, 400, 'INVALID_PROFILE', 'Profile photo must be 3 MB or smaller.')
	}

	try {
		const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
			new: true,
			runValidators: true,
		}).select('_id name email phone address company jobTitle bio profilePicture googleId createdAt updatedAt').lean()

		if (!user) {
			return respondWithError(res, 404, 'USER_NOT_FOUND', 'The account could not be found.')
		}
		return res.json({ profile: profileData(user), message: 'Profile updated.' })
	} catch (error) {
		if (error.code === 11000) {
			return respondWithError(res, 409, 'EMAIL_IN_USE', 'That email address is already in use.')
		}
		throw error
	}
}

async function downloadProfile(req, res) {
	const user = await User.findById(req.user._id)
		.select('_id name email phone address company jobTitle bio profilePicture createdAt updatedAt')
		.lean()

	if (!user) {
		return respondWithError(res, 404, 'USER_NOT_FOUND', 'The account could not be found.')
	}

	const profile = profileData(user)
	const pdf = new PDFDocument({ size: 'A4', margin: 56 })
	res.set({
		'Content-Type': 'application/pdf',
		'Content-Disposition': 'attachment; filename="s19-profile.pdf"',
	})
	pdf.pipe(res)
	pdf.fontSize(24).fillColor('#173c32').text('S19 Profile')
	pdf.moveDown(0.4)
	pdf.fontSize(10).fillColor('#68756f').text('Personal account details')
	pdf.moveDown(1.5)

	const fields = [
		['Full name', profile.name],
		['Email address', profile.email],
		['Phone number', profile.phone],
		['Address', profile.address],
		['Company', profile.company],
		['Job title', profile.jobTitle],
		['About', profile.bio],
		['Member since', profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : ''],
	]
	for (const [label, value] of fields) {
		pdf.fontSize(9).fillColor('#68756f').text(label.toUpperCase())
		pdf.moveDown(0.25)
		pdf.fontSize(12).fillColor('#17231e').text(value || 'Not provided', { width: 480 })
		pdf.moveDown(1)
	}

	pdf.end()
	return undefined
}

module.exports = { viewProfile, updateProfile, downloadProfile }