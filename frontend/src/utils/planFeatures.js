export const PLAN_FEATURE_OPTIONS = [
	{ key: 'pdf_editor', label: 'PDF editor and downloads' },
	{ key: 'presentation', label: 'Presentation Studio exports' },
	{ key: 'file_converter', label: 'File converter downloads' },
	{ key: 'file_compressor', label: 'File compressor downloads' },
	{ key: 'image_tools', label: 'Image tool downloads' },
	{ key: 'writing_pad', label: 'Writing Pad downloads' },
]

export function getPlanFeatureLabels(featureKeys = []) {
	return PLAN_FEATURE_OPTIONS.filter(({ key }) => featureKeys.includes(key)).map(({ label }) => label)
}
