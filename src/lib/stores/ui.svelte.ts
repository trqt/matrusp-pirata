/**
 * UI state using Svelte 5 runes
 * Manages dark mode, sidebar visibility, and other UI preferences
 */

const UI_STORAGE_KEY = 'matrusp-ui'

type Theme = 'light' | 'dark' | 'system'

interface UISettings {
	theme: Theme
	sidebarOpen: boolean
}

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light'
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

class UIState {
	theme = $state<Theme>('system')
	sidebarOpen = $state(true)
	private systemTheme = $state<'light' | 'dark'>(getSystemTheme())

	// Resolved theme (accounts for system preference)
	resolvedTheme = $derived<'light' | 'dark'>(
		this.theme === 'system' ? this.systemTheme : this.theme
	)

	isDark = $derived(this.resolvedTheme === 'dark')

	constructor() {
		// Load saved preferences
		if (typeof window !== 'undefined') {
			this.load()
			this.applyTheme()

			// Listen for system theme changes
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				this.systemTheme = e.matches ? 'dark' : 'light'
				if (this.theme === 'system') {
					this.applyTheme()
				}
			})
		}
	}

	setTheme(theme: Theme): void {
		this.theme = theme
		this.applyTheme()
		this.save()
	}

	toggleTheme(): void {
		const next: Theme = this.resolvedTheme === 'dark' ? 'light' : 'dark'
		this.setTheme(next)
	}

	toggleSidebar(): void {
		this.sidebarOpen = !this.sidebarOpen
		this.save()
	}

	private applyTheme(): void {
		if (typeof document === 'undefined') return

		const isDark = this.theme === 'system' ? this.systemTheme === 'dark' : this.theme === 'dark'
		document.documentElement.classList.toggle('dark', isDark)
	}

	private save(): void {
		try {
			const settings: UISettings = {
				theme: this.theme,
				sidebarOpen: this.sidebarOpen,
			}
			localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(settings))
		} catch (e) {
			console.error('Failed to save UI settings:', e)
		}
	}

	private load(): void {
		try {
			const saved = localStorage.getItem(UI_STORAGE_KEY)
			if (!saved) return

			const settings: UISettings = JSON.parse(saved)
			this.theme = settings.theme ?? 'system'
			this.sidebarOpen = settings.sidebarOpen ?? true
		} catch (e) {
			console.error('Failed to load UI settings:', e)
		}
	}
}

export const uiState = new UIState()
