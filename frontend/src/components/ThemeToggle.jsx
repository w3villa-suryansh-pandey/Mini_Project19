import { useLayoutEffect, useState } from 'react'

function ThemeToggle() {
	const [theme, setTheme] = useState(() => localStorage.getItem('w3-theme') || 'light')
	const isDark = theme === 'dark'

	useLayoutEffect(() => {
		document.documentElement.dataset.theme = theme
		document.documentElement.style.colorScheme = theme
		localStorage.setItem('w3-theme', theme)
		const themeColor = document.querySelector('meta[name="theme-color"]')
		if (themeColor) themeColor.content = theme === 'dark' ? '#111722' : '#f8faff'
	}, [theme])

	function toggleTheme() {
		setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')
	}

	return (
		<button
			className="theme-toggle"
			type="button"
			onClick={toggleTheme}
			aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
			aria-pressed={isDark}
			title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				{isDark
					? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>
					: <path d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.5 8.5 0 1 0 20.2 15.6Z" />}
			</svg>
		</button>
	)
}

export default ThemeToggle
