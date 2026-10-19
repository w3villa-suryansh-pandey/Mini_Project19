export function applyTheme(theme) {
	const nextTheme = theme === 'dark' ? 'dark' : 'light'
	document.documentElement.dataset.theme = nextTheme
	document.documentElement.style.colorScheme = nextTheme
	try {
		window.localStorage.setItem('w3-theme', nextTheme)
	} catch {
		// Keep the current page themed even when browser storage is unavailable.
	}
	const themeColor = document.querySelector('meta[name="theme-color"]')
	if (themeColor) themeColor.content = nextTheme === 'dark' ? '#111722' : '#f8faff'
}
