const STORAGE_KEY = 'theme'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || getSystemTheme()
  } catch {
    return getSystemTheme()
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage unavailable - theme just won't persist across reloads
  }
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(getTheme())
}
