const mongoose = require('mongoose')

const subscriptionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		razorpayPaymentId: {
			type: String,
			required: true,
			unique: true,
			sparse: true,
		},
		planId: {
			type: String,
			required: true,
		},
		planName: {
			type: String,
			required: true,
		},
		durationValue: {
			type: Number,
			required: true,
		},
		durationUnit: {
			type: String,
			enum: ['hour', 'day', 'week', 'month', 'year'],
			required: true,
		},
		amountInPaise: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			enum: ['inr'],
			default: 'inr',
		},
		startsAt: {
			type: Date,
			required: true,
		},
		expiresAt: {
			type: Date,
			required: true,
		},
		status: {
			type: String,
			enum: ['active', 'expired'],
			default: 'active',
		},
	},
	{ timestamps: true }
)

subscriptionSchema.index({ userId: 1, status: 1, expiresAt: -1 })

module.exports = mongoose.model('Subscription', subscriptionSchema)