/**
 * Share Service
 * Generates shareable URLs with encoded state and handles loading from share links
 */

import type { SerializedAppState, LectureData } from '~/lib/models/types'
import { appState } from '~/lib/stores/state.svelte'
import { db } from '~/lib/services/database'

/**
 * Generate a shareable URL with the current state encoded as base64
 */
export function generateShareURL(): string {
	const state = appState.serialize()
	const json = JSON.stringify(state)
	const encoded = btoa(unescape(encodeURIComponent(json)))

	const url = new URL(window.location.href)
	url.search = '' // Clear existing params
	url.searchParams.set('data', encoded)

	return url.toString()
}

/**
 * Check if the current URL has share data
 */
export function hasShareData(): boolean {
	const params = new URLSearchParams(window.location.search)
	return params.has('data')
}

/**
 * Parse share data from URL
 */
function parseShareData(): SerializedAppState | null {
	try {
		const params = new URLSearchParams(window.location.search)
		const encoded = params.get('data')

		if (!encoded) return null

		const json = decodeURIComponent(escape(atob(encoded)))
		const state: SerializedAppState = JSON.parse(json)

		// Basic validation
		if (!state.plans || !Array.isArray(state.plans)) {
			console.error('Invalid share data: missing plans array')
			return null
		}

		return state
	} catch (e) {
		console.error('Failed to parse share data:', e)
		return null
	}
}

/**
 * Load state from share URL
 * Returns true if state was loaded successfully
 */
export async function loadFromShareURL(): Promise<boolean> {
	const state = parseShareData()
	if (!state) return false

	try {
		// Fetch all lecture data needed
		const fetchLecture = async (codigo: string): Promise<LectureData | undefined> => {
			return db.lectures.get(codigo)
		}

		// Build the plans with full lecture data
		const restoredPlans = []

		for (const savedPlan of state.plans) {
			const lectures = []

			for (const savedLecture of savedPlan.lectures) {
				const lectureData = await fetchLecture(savedLecture.codigo)
				if (lectureData) {
					lectures.push({
						data: lectureData,
						color: savedLecture.color,
						selected: savedLecture.selected,
						selectedClassrooms: new Set(savedLecture.selectedClassrooms),
					})
				}
			}

			restoredPlans.push({
				id: savedPlan.id,
				name: savedPlan.name,
				lectures,
				activeCombinationIndex: savedPlan.activeCombinationIndex,
			})
		}

		if (restoredPlans.length > 0) {
			// Direct assignment to public state properties
			appState.plans = restoredPlans
			appState.activePlanIndex = Math.min(state.activePlanIndex, restoredPlans.length - 1)

			// Clear the URL params after loading
			clearShareParams()

			return true
		}

		return false
	} catch (e) {
		console.error('Failed to load from share URL:', e)
		return false
	}
}

/**
 * Clear share parameters from URL without page reload
 */
export function clearShareParams(): void {
	const url = new URL(window.location.href)
	url.search = ''
	window.history.replaceState({}, '', url.toString())
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch (e) {
		console.error('Failed to copy to clipboard:', e)
		return false
	}
}

/**
 * Generate WhatsApp share URL
 */
export function getWhatsAppShareURL(shareURL: string): string {
	const message = `Esta é minha grade horária no MatrUSP: ${shareURL}`
	return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
}

/**
 * Generate email share URL
 */
export function getEmailShareURL(shareURL: string): string {
	const subject = 'Grade Horária MatrUSP'
	const body = `Esta é minha grade horária no MatrUSP: ${shareURL}`
	return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
