const mongoose = require('mongoose')

const cronJobConfigSchema = new mongoose.Schema(
	{
		id: {
			type: String,
			required: true,
			unique: true,
		},
		name: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		schedule: {
			type: String,
			default: 'Every minute',
		},
		enabled: {
			type: Boolean,
			default: true,
		},
		deleted: {
			type: Boolean,
			default: false,
		},
		lastRunAt: {
			type: Date,
			default: null,
		},
		lastExpiredCount: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
)

module.exports = mongoose.model('CronJobConfig', cronJobConfigSchema)