/**
 * Combination computation service
 * 
 * A "combination" is a valid set of classroom selections that don't conflict in time.
 * 
 * Key concepts:
 * - ClassroomGroup: Array of classrooms with the same schedule (different professors/sections)
 * - Combination: Array of ClassroomGroups, one per lecture, that don't conflict
 */

import type { ClassroomData, LectureData, PlanLecture, DayOfWeek } from '~/lib/models/types'
import { parseTime } from '~/lib/models/types'

/** Maximum number of combinations to compute (to prevent UI freeze) */
export const MAX_COMBINATIONS = 1000

/**
 * Result of combination computation
 */
export interface CombinationResult {
	combinations: Combination[]
	hitLimit: boolean
}

/**
 * A group of classrooms with identical schedules (same times, different sections)
 */
export interface ClassroomGroup {
	lecture: PlanLecture
	classrooms: ClassroomData[]
}

/**
 * A valid combination of classroom groups (one per lecture, no conflicts)
 */
export interface Combination {
	groups: ClassroomGroup[]
	lectureCredits: number
	workCredits: number
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
	start1: number,
	end1: number,
	start2: number,
	end2: number
): boolean {
	return start1 < end2 && end1 > start2
}

/**
 * Parse date string "DD/MM/YYYY" to Date object
 */
function parseDate(dateStr: string): Date {
	const [day, month, year] = dateStr.split('/').map(Number)
	return new Date(year, month - 1, day)
}

/**
 * Check if two date ranges overlap
 */
function dateRangesOverlap(
	start1: string,
	end1: string,
	start2: string,
	end2: string
): boolean {
	try {
		const d1Start = parseDate(start1)
		const d1End = parseDate(end1)
		const d2Start = parseDate(start2)
		const d2End = parseDate(end2)

		return d1Start < d2End && d1End > d2Start
	} catch {
		// If dates are invalid, assume they overlap to be safe
		return true
	}
}

/**
 * Check if two classrooms have conflicting schedules
 */
export function classroomsConflict(c1: ClassroomData, c2: ClassroomData): boolean {
	// Guard against missing data
	if (!c1.horario?.length || !c2.horario?.length) {
		return false
	}

	// First check if date ranges overlap
	if (c1.inicio && c1.fim && c2.inicio && c2.fim) {
		if (!dateRangesOverlap(c1.inicio, c1.fim, c2.inicio, c2.fim)) {
			return false
		}
	}

	// Then check if any schedules overlap
	return c1.horario.some((s1) =>
		c2.horario.some((s2) => {
			if (s1.dia !== s2.dia) return false

			const start1 = parseTime(s1.inicio)
			const end1 = parseTime(s1.fim)
			const start2 = parseTime(s2.inicio)
			const end2 = parseTime(s2.fim)

			return timeRangesOverlap(start1, end1, start2, end2)
		})
	)
}

/**
 * Check if a classroom group conflicts with any group in a combination
 */
function groupConflictsWithCombination(
	group: ClassroomGroup,
	combination: ClassroomGroup[]
): boolean {
	// Use the first classroom in the group as representative (they all have same schedule)
	const classroom = group.classrooms[0]
	if (!classroom) return false

	return combination.some((existingGroup) => {
		const existingClassroom = existingGroup.classrooms[0]
		if (!existingClassroom) return false
		return classroomsConflict(classroom, existingClassroom)
	})
}

/**
 * Group classrooms by their schedule (same day/time combinations)
 * Classrooms with identical schedules can be grouped together
 */
export function groupClassroomsBySchedule(
	lecture: PlanLecture
): ClassroomGroup[] {
	const groups: ClassroomGroup[] = []

	if (!lecture.data.turmas) return groups

	for (const classroom of lecture.data.turmas) {
		// Check if classroom is selected (or if none are selected, include all)
		const isSelected =
			lecture.selectedClassrooms.size === 0 ||
			lecture.selectedClassrooms.has(classroom.codigo)

		if (!isSelected) continue

		// Skip classrooms without schedules
		if (!classroom.horario?.length) continue

		// Try to find an existing group with the same schedule
		const existingGroup = groups.find((group) => {
			const representative = group.classrooms[0]
			if (!representative?.horario) return false

			// Must have same number of schedules
			if (representative.horario.length !== classroom.horario.length) {
				return false
			}

			// All schedules must match exactly
			return representative.horario.every((repSchedule) =>
				classroom.horario.some(
					(classSchedule) =>
						repSchedule.dia === classSchedule.dia &&
						repSchedule.inicio === classSchedule.inicio &&
						repSchedule.fim === classSchedule.fim
				)
			)
		})

		if (existingGroup) {
			existingGroup.classrooms.push(classroom)
		} else {
			groups.push({
				lecture,
				classrooms: [classroom],
			})
		}
	}

	return groups
}

/**
 * Compute all valid combinations for the given lectures
 * 
 * Algorithm:
 * 1. For each lecture, group classrooms by schedule
 * 2. Start with empty combinations
 * 3. For each lecture, try to add each classroom group to each existing combination
 * 4. Only keep combinations where there are no conflicts
 * 5. Limit to MAX_COMBINATIONS to prevent UI freeze
 * 
 * @returns Object with combinations array and hitLimit flag
 */
export function computeCombinations(lectures: PlanLecture[]): CombinationResult {
	try {
		// Filter to selected lectures only
		const selectedLectures = lectures.filter((l) => l.selected)

		if (selectedLectures.length === 0) {
			return { combinations: [], hitLimit: false }
		}

		// Start with empty combinations
		let combinations: ClassroomGroup[][] = []
		let hitLimit = false

		for (const lecture of selectedLectures) {
			const classroomGroups = groupClassroomsBySchedule(lecture)

			// Skip lectures with no available classroom groups
			if (classroomGroups.length === 0) continue

			const newCombinations: ClassroomGroup[][] = []

			for (const group of classroomGroups) {
				if (combinations.length === 0) {
					// First lecture - each group becomes a combination
					newCombinations.push([group])
				} else {
					// Try to add this group to each existing combination
					for (const combination of combinations) {
						if (!groupConflictsWithCombination(group, combination)) {
							newCombinations.push([...combination, group])
							
							// Check limit
							if (newCombinations.length >= MAX_COMBINATIONS) {
								hitLimit = true
								break
							}
						}
					}
				}
				
				if (hitLimit) break
			}

			combinations = newCombinations

			// Early exit if no valid combinations remain or hit limit
			if (combinations.length === 0 || hitLimit) {
				break
			}
		}

		// Convert to Combination objects with credits
		const result = combinations.map((groups) => {
			let lectureCredits = 0
			let workCredits = 0

			for (const group of groups) {
				lectureCredits += group.lecture.data.creditos_aula
				workCredits += group.lecture.data.creditos_trabalho
			}

			return {
				groups,
				lectureCredits,
				workCredits,
			}
		})

		return { combinations: result, hitLimit }
	} catch (error) {
		console.error('Error computing combinations:', error)
		return { combinations: [], hitLimit: false }
	}
}

/**
 * Find the combination most similar to a previous one
 * Used when recomputing combinations to maintain user's selection
 */
export function findClosestCombination(
	combinations: Combination[],
	previous: Combination | null
): Combination | null {
	if (combinations.length === 0) return null
	if (!previous) return combinations[0]

	let bestIndex = 0
	let bestScore = -1

	for (let i = 0; i < combinations.length; i++) {
		const score = getSimilarityScore(previous, combinations[i])
		if (score > bestScore) {
			bestScore = score
			bestIndex = i
		}
	}

	return combinations[bestIndex]
}

/**
 * Calculate similarity score between two combinations
 * Based on how many classroom groups they share
 */
function getSimilarityScore(a: Combination, b: Combination): number {
	let score = 0

	for (const groupA of a.groups) {
		for (const groupB of b.groups) {
			// Same lecture and same first classroom = same group
			if (
				groupA.lecture.data.codigo === groupB.lecture.data.codigo &&
				groupA.classrooms[0].codigo === groupB.classrooms[0].codigo
			) {
				score++
			}
		}
	}

	return score
}
