const mongoose = require('mongoose')

const planSchema = new mongoose.Schema(
	{
		id: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
			maxlength: 60,
		},
		priceInPaise: {
			type: Number,
			required: true,
			min: 100,
		},
		durationValue: {
			type: Number,
			required: true,
			min: 1,
			max: 3650,
		},
		durationUnit: {
			type: String,
			enum: ['hour', 'day', 'week', 'month', 'year'],
			required: true,
		},
		features: {
			type: [String],
			default: [],
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		sortOrder: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
)

module.exports = mongoose.model('Plan', planSchema)