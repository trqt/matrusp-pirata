import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	// Use VITE_BASE_PATH env var, or default to '/' for local dev
	base: process.env.VITE_BASE_PATH || '/',
	resolve: {
		alias: {
			'~': '/src',
		},
	},
	server: {
		watch: {
			// Ignore ref folder and public/db (symlinked, has ~6000 files)
			ignored: ['**/ref/**', '**/public/db/**'],
		},
	},
})
