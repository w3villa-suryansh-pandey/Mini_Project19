const User = require('../../models/User')

const PROFILE_FIELDS = ['name', 'email', 'phone', 'address', 'company', 'jobTitle', 'bio', 'profilePicture']

function profileData(user) {
	return {
		id: user._id.toString(),
		name: user.name || '',
		email: user.email || '',
		role: user.role,
		phone: user.phone || '',
		address: user.address || '',
		company: user.company || '',
		jobTitle: user.jobTitle || '',
		bio: user.bio || '',
		profilePicture: user.profilePicture || '',
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	}
}

function invalid(res, message) {
	return res.status(400).json({ error: { code: 'INVALID_PROFILE', message } })
}

async function getAdminProfile(req, res) {
	const user = await User.findOne({ _id: req.user._id, role: 'admin' })
		.select('_id name email role phone address company jobTitle bio profilePicture createdAt updatedAt')
		.lean()
	if (!user) return res.status(404).json({ error: { code: 'ADMIN_NOT_FOUND', message: 'The admin account could not be found.' } })
	return res.json({ profile: profileData(user) })
}

async function updateAdminProfile(req, res) {
	const updates = {}
	for (const field of PROFILE_FIELDS) {
		if (Object.hasOwn(req.body || {}, field)) updates[field] = req.body[field]
	}
	if (!Object.keys(updates).length) return invalid(res, 'Provide at least one profile field to update.')
	for (const [field, value] of Object.entries(updates)) {
		if (typeof value !== 'string') return invalid(res, `${field} must be text.`)
		updates[field] = value.trim()
	}
	if (Object.hasOwn(updates, 'name') && (!updates.name || updates.name.length > 100)) {
		return invalid(res, 'Name is required and must be 100 characters or fewer.')
	}
	if (Object.hasOwn(updates, 'email')) {
		updates.email = updates.email.toLowerCase()
		if (!/^\S+@\S+\.\S+$/.test(updates.email)) return invalid(res, 'Enter a valid email address.')
	}
	const maxLengths = { phone: 40, address: 240, company: 120, jobTitle: 120, bio: 240 }
	for (const [field, maxLength] of Object.entries(maxLengths)) {
		if (Object.hasOwn(updates, field) && updates[field].length > maxLength) return invalid(res, `${field} must be ${maxLength} characters or fewer.`)
	}
	if (Object.hasOwn(updates, 'profilePicture') && updates.profilePicture.length > 4_200_000) {
		return invalid(res, 'Profile photo must be 3 MB or smaller.')
	}

	try {
		const user = await User.findOneAndUpdate({ _id: req.user._id, role: 'admin' }, { $set: updates }, {
			new: true,
			runValidators: true,
		}).select('_id name email role phone address company jobTitle bio profilePicture createdAt updatedAt').lean()
		if (!user) return res.status(404).json({ error: { code: 'ADMIN_NOT_FOUND', message: 'The admin account could not be found.' } })
		return res.json({ profile: profileData(user), message: 'Admin profile updated.' })
	} catch (error) {
		if (error.code === 11000) return res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'That email address is already in use.' } })
		throw error
	}
}

module.exports = { getAdminProfile, updateAdminProfile }
