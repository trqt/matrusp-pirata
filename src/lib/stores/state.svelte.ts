/**
 * Main application state using Svelte 5 runes
 * Manages plans, lectures, and combinations
 */

import type {
	Plan,
	PlanLecture,
	LectureData,
	ScheduleColor,
	SerializedAppState,
	SerializedPlan,
} from '~/lib/models/types'
import { SCHEDULE_COLORS } from '~/lib/models/types'
import {
	computeCombinations,
	findClosestCombination,
	classroomsConflict,
	type Combination,
	type CombinationResult,
	MAX_COMBINATIONS,
} from '~/lib/services/combination'

const STORAGE_KEY = 'matrusp-state'
const STATE_VERSION = 1

function generateId(): string {
	return Math.random().toString(36).substring(2, 9)
}

function createEmptyPlan(name = 'Plano 1'): Plan {
	return {
		id: generateId(),
		name,
		lectures: [],
		activeCombinationIndex: 0,
	}
}

/**
 * Check if a new lecture conflicts with ALL turmas of an existing lecture
 * Returns true if they are mutually exclusive (no valid combination possible)
 */
function lecturesAreMutuallyExclusive(
	newLecture: LectureData,
	existingLecture: PlanLecture
): boolean {
	try {
		// Get the turmas to check for the existing lecture
		const existingTurmas = existingLecture.selectedClassrooms.size > 0
			? existingLecture.data.turmas?.filter(t => existingLecture.selectedClassrooms.has(t.codigo)) ?? []
			: existingLecture.data.turmas ?? []

		// Get the turmas to check for the new lecture
		const newTurmas = newLecture.turmas ?? []

		if (!existingTurmas.length || !newTurmas.length) return false

		// Check if EVERY combination of turmas conflicts
		for (const existingTurma of existingTurmas) {
			for (const newTurma of newTurmas) {
				// If we find at least one non-conflicting pair, they're not mutually exclusive
				if (!classroomsConflict(existingTurma, newTurma)) {
					return false
				}
			}
		}

		// All combinations conflict - they are mutually exclusive
		return true
	} catch (e) {
		console.error('Error checking lecture conflict:', e)
		return false
	}
}

class AppState {
	plans = $state<Plan[]>([createEmptyPlan()])
	activePlanIndex = $state(0)

	// Derived state
	activePlan = $derived(this.plans[this.activePlanIndex])

	selectedLectures = $derived(
		this.activePlan?.lectures.filter((l: PlanLecture) => l.selected) ?? []
	)

	totalCredits = $derived(
		this.selectedLectures.reduce(
			(acc: { aula: number; trabalho: number }, l: PlanLecture) => ({
				aula: acc.aula + l.data.creditos_aula,
				trabalho: acc.trabalho + l.data.creditos_trabalho,
			}),
			{ aula: 0, trabalho: 0 }
		)
	)

	// Combinations for the active plan
	combinationResult = $derived<CombinationResult>(
		this.activePlan ? computeCombinations(this.activePlan.lectures) : { combinations: [], hitLimit: false }
	)

	combinations = $derived(this.combinationResult.combinations)
	
	combinationsHitLimit = $derived(this.combinationResult.hitLimit)

	activeCombination = $derived(
		this.combinations[this.activePlan?.activeCombinationIndex ?? 0] ?? null
	)

	// ============================================
	// Plan Management
	// ============================================

	addPlan(name?: string): void {
		// Find the next available plan number
		let planNumber = 1
		const existingNumbers = new Set(
			this.plans
				.map((p) => {
					const match = p.name.match(/^Plano (\d+)$/)
					return match ? parseInt(match[1], 10) : null
				})
				.filter((n): n is number => n !== null)
		)
		while (existingNumbers.has(planNumber)) {
			planNumber++
		}
		const plan = createEmptyPlan(name ?? `Plano ${planNumber}`)
		this.plans.push(plan)
		this.activePlanIndex = this.plans.length - 1
	}

	removePlan(index: number): void {
		if (this.plans.length <= 1) return // Keep at least one plan

		this.plans.splice(index, 1)
		if (this.activePlanIndex >= this.plans.length) {
			this.activePlanIndex = this.plans.length - 1
		}
	}

	renamePlan(index: number, name: string): void {
		if (this.plans[index]) {
			this.plans[index].name = name
		}
	}

	duplicatePlan(index: number): void {
		const source = this.plans[index]
		if (!source) return

		const copy: Plan = {
			id: generateId(),
			name: `${source.name} (cópia)`,
			lectures: source.lectures.map((l: PlanLecture) => ({
				...l,
				selectedClassrooms: new Set(l.selectedClassrooms),
			})),
			activeCombinationIndex: source.activeCombinationIndex,
		}
		this.plans.splice(index + 1, 0, copy)
		this.activePlanIndex = index + 1
	}

	setActivePlan(index: number): void {
		if (index >= 0 && index < this.plans.length) {
			this.activePlanIndex = index
		}
	}

	// ============================================
	// Lecture Management
	// ============================================

	private getNextColor(): ScheduleColor {
		const usedColors = new Set(
			this.activePlan?.lectures.map((l: PlanLecture) => l.color) ?? []
		)
		for (const color of SCHEDULE_COLORS) {
			if (!usedColors.has(color)) return color
		}
		return SCHEDULE_COLORS[0] // Fallback to first color
	}

	addLecture(lecture: LectureData): boolean {
		if (!this.activePlan) return false

		// Check if already added
		if (this.activePlan.lectures.some((l: PlanLecture) => l.data.codigo === lecture.codigo)) {
			return false
		}

		// Find lectures that conflict with the new one
		const conflictingLectures: PlanLecture[] = []
		for (const existingLecture of this.activePlan.lectures) {
			if (existingLecture.selected && lecturesAreMutuallyExclusive(lecture, existingLecture)) {
				conflictingLectures.push(existingLecture)
			}
		}

		// Auto-deselect conflicting lectures
		for (const conflicting of conflictingLectures) {
			conflicting.selected = false
		}

		const planLecture: PlanLecture = {
			data: lecture,
			color: this.getNextColor(),
			selected: true,
			selectedClassrooms: new Set(),
		}

		this.activePlan.lectures.push(planLecture)
		return true
	}

	removeLecture(codigo: string): void {
		if (!this.activePlan) return

		const index = this.activePlan.lectures.findIndex(
			(l: PlanLecture) => l.data.codigo === codigo
		)
		if (index !== -1) {
			this.activePlan.lectures.splice(index, 1)
		}
	}

	toggleLecture(codigo: string): void {
		if (!this.activePlan) return

		const lecture = this.activePlan.lectures.find(
			(l: PlanLecture) => l.data.codigo === codigo
		)
		if (!lecture) return

		const newState = !lecture.selected

		if (newState) {
			// Turning ON - check for conflicts and deselect them
			for (const other of this.activePlan.lectures) {
				if (other.selected && other.data.codigo !== codigo) {
					if (lecturesAreMutuallyExclusive(lecture.data, other)) {
						other.selected = false
					}
				}
			}
		}

		lecture.selected = newState
	}

	setLectureColor(codigo: string, color: ScheduleColor): void {
		if (!this.activePlan) return

		const lecture = this.activePlan.lectures.find(
			(l: PlanLecture) => l.data.codigo === codigo
		)
		if (lecture) {
			lecture.color = color
		}
	}

	toggleClassroom(lectureCodigo: string, classroomCodigo: string): void {
		if (!this.activePlan) return

		const lecture = this.activePlan.lectures.find(
			(l: PlanLecture) => l.data.codigo === lectureCodigo
		)
		if (!lecture) return

		if (lecture.selectedClassrooms.has(classroomCodigo)) {
			lecture.selectedClassrooms.delete(classroomCodigo)
		} else {
			lecture.selectedClassrooms.add(classroomCodigo)
		}
	}

	// ============================================
	// Combination Management
	// ============================================

	setActiveCombination(index: number): void {
		if (!this.activePlan) return
		const maxIndex = Math.max(0, this.combinations.length - 1)
		this.activePlan.activeCombinationIndex = Math.min(Math.max(0, index), maxIndex)
	}

	// ============================================
	// Persistence
	// ============================================

	serialize(): SerializedAppState {
		return {
			version: STATE_VERSION,
			activePlanIndex: this.activePlanIndex,
			plans: this.plans.map(
				(plan): SerializedPlan => ({
					id: plan.id,
					name: plan.name,
					activeCombinationIndex: plan.activeCombinationIndex,
					lectures: plan.lectures.map((l: PlanLecture) => ({
						codigo: l.data.codigo,
						color: l.color,
						selected: l.selected,
						selectedClassrooms: Array.from(l.selectedClassrooms),
					})),
				})
			),
		}
	}

	save(): void {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()))
		} catch (e) {
			console.error('Failed to save state:', e)
		}
	}

	async load(fetchLecture: (codigo: string) => Promise<LectureData | undefined>): Promise<void> {
		try {
			const saved = localStorage.getItem(STORAGE_KEY)
			if (!saved) return

			const data: SerializedAppState = JSON.parse(saved)
			if (data.version !== STATE_VERSION) {
				console.warn('State version mismatch, ignoring saved state')
				return
			}

			// Restore plans with lecture data
			const restoredPlans: Plan[] = []

			for (const savedPlan of data.plans) {
				const lectures: PlanLecture[] = []

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
				this.plans = restoredPlans
				this.activePlanIndex = Math.min(data.activePlanIndex, restoredPlans.length - 1)
			}
		} catch (e) {
			console.error('Failed to load state:', e)
		}
	}

	reset(): void {
		this.plans = [createEmptyPlan()]
		this.activePlanIndex = 0
		localStorage.removeItem(STORAGE_KEY)
	}
}

export const appState = new AppState()
