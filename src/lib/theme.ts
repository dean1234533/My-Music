export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = 'myMusic.theme'

/** Harmless local UI preference — never the source of truth for anything account-related, so localStorage is the right (and only necessary) place for it. */
export function getStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

/** Applies the choice to the document (see the [data-theme] rules in index.css) and persists it. */
export function setTheme(theme: ThemePreference): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Non-critical — the choice just won't survive a reload if storage is unavailable.
  }
}

/** Call once on app start to apply whatever was previously chosen. */
export function applyStoredTheme(): void {
  setTheme(getStoredTheme())
}
