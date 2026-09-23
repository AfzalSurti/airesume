import { useState } from 'react'
import { getTheme, setTheme } from '../theme'

export function ThemeToggle({ className = '' }) {
  const [theme, setThemeState] = useState(getTheme())

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={toggle} aria-label="Toggle light/dark theme">
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
