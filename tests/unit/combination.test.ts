import { describe, it, expect } from 'vitest'
import {
	classroomsConflict,
	groupClassroomsBySchedule,
	computeCombinations,
	findClosestCombination,
	MAX_COMBINATIONS,
	type CombinationResult,
	type ClassroomGroup,
	type Combination,
} from '~/lib/services/combination'
import type { LectureData, ClassroomData, ScheduleData, PlanLecture } from '~/lib/models/types'

// ============================================
// Test Helpers
// ============================================

function makeSchedule(dia: 'seg' | 'ter' | 'qua' | 'qui' | 'sex', inicio: string, fim: string): ScheduleData {
	return { dia, inicio, fim, professores: [] }
}

function makeClassroom(codigo: string, horario: ScheduleData[]): ClassroomData {
	return {
		codigo,
		tipo: 'Teórica',
		inicio: '01/03/2025',
		fim: '30/06/2025',
		horario,
		vagas: {},
	}
}

function makeLecture(codigo: string, turmas: ClassroomData[]): LectureData {
	return {
		codigo,
		nome: `Lecture ${codigo}`,
		creditos_aula: 4,
		creditos_trabalho: 0,
		unidade: 'Test Unit',
		departamento: 'Test Dept',
		campus: 'Test Campus',
		turmas,
	}
}

function makePlanLecture(
	lecture: LectureData,
	options: { selected?: boolean; selectedClassrooms?: Set<string>; color?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 } = {}
): PlanLecture {
	return {
		data: lecture,
		color: options.color ?? 1,
		selected: options.selected ?? true,
		selectedClassrooms: options.selectedClassrooms ?? new Set(),
	}
}

// ============================================
// Tests
// ============================================

describe('classroomsConflict', () => {
	it('detects conflict when schedules overlap on same day', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [makeSchedule('seg', '11:00', '13:00')])
		expect(classroomsConflict(c1, c2)).toBe(true)
	})

	it('no conflict for different days', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [makeSchedule('ter', '10:00', '12:00')])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('no conflict for adjacent times', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '08:00', '10:00')])
		const c2 = makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('no conflict when one has empty schedule', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('handles multiple schedules - conflict exists', () => {
		const c1 = makeClassroom('T1', [
			makeSchedule('seg', '08:00', '10:00'),
			makeSchedule('qua', '14:00', '16:00'),
		])
		const c2 = makeClassroom('T2', [
			makeSchedule('ter', '10:00', '12:00'),
			makeSchedule('qua', '15:00', '17:00'), // overlaps with c1's qua
		])
		expect(classroomsConflict(c1, c2)).toBe(true)
	})

	it('handles multiple schedules - no conflict', () => {
		const c1 = makeClassroom('T1', [
			makeSchedule('seg', '08:00', '10:00'),
			makeSchedule('qua', '08:00', '10:00'),
		])
		const c2 = makeClassroom('T2', [
			makeSchedule('ter', '08:00', '10:00'),
			makeSchedule('qui', '08:00', '10:00'),
		])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})
})

describe('groupClassroomsBySchedule', () => {
	it('groups classrooms with identical schedules', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
			makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')]), // same as T1
			makeClassroom('T3', [makeSchedule('ter', '10:00', '12:00')]), // different day
		])
		const planLecture = makePlanLecture(lecture)
		const groups = groupClassroomsBySchedule(planLecture)

		expect(groups).toHaveLength(2)
		
		const group1 = groups.find((g) => g.classrooms.some((c) => c.codigo === 'T1'))
		const group2 = groups.find((g) => g.classrooms.some((c) => c.codigo === 'T3'))
		
		expect(group1?.classrooms).toHaveLength(2) // T1 and T2
		expect(group2?.classrooms).toHaveLength(1) // T3 only
	})

	it('respects selectedClassrooms filter', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
			makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')]),
			makeClassroom('T3', [makeSchedule('ter', '10:00', '12:00')]),
		])
		const planLecture = makePlanLecture(lecture, {
			selectedClassrooms: new Set(['T1', 'T3']),
		})
		const groups = groupClassroomsBySchedule(planLecture)

		expect(groups).toHaveLength(2)
		
		const allClassrooms = groups.flatMap((g) => g.classrooms.map((c) => c.codigo))
		expect(allClassrooms).toContain('T1')
		expect(allClassrooms).toContain('T3')
		expect(allClassrooms).not.toContain('T2')
	})

	it('skips classrooms without schedules', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
			makeClassroom('T2', []), // empty schedule
		])
		const planLecture = makePlanLecture(lecture)
		const groups = groupClassroomsBySchedule(planLecture)

		expect(groups).toHaveLength(1)
		expect(groups[0].classrooms[0].codigo).toBe('T1')
	})

	it('returns empty array for empty turmas', () => {
		const lecture = makeLecture('MAC0110', [])
		const planLecture = makePlanLecture(lecture)
		const groups = groupClassroomsBySchedule(planLecture)

		expect(groups).toHaveLength(0)
	})
})

describe('computeCombinations', () => {
	it('returns empty for no lectures', () => {
		const result = computeCombinations([])
		expect(result.combinations).toHaveLength(0)
		expect(result.hitLimit).toBe(false)
	})

	it('returns empty for no selected lectures', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const planLecture = makePlanLecture(lecture, { selected: false })
		const result = computeCombinations([planLecture])

		expect(result.combinations).toHaveLength(0)
	})

	it('computes combinations for single lecture with multiple classrooms', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
			makeClassroom('T2', [makeSchedule('ter', '10:00', '12:00')]),
		])
		const planLecture = makePlanLecture(lecture)
		const result = computeCombinations([planLecture])

		expect(result.combinations).toHaveLength(2)
		expect(result.hitLimit).toBe(false)
	})

	it('computes valid combinations for two non-conflicting lectures', () => {
		const lecture1 = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '08:00', '10:00')]),
			makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const lecture2 = makeLecture('MAC0121', [
			makeClassroom('T1', [makeSchedule('ter', '08:00', '10:00')]),
			makeClassroom('T2', [makeSchedule('ter', '10:00', '12:00')]),
		])

		const result = computeCombinations([
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		])

		// 2 options for lecture1 × 2 options for lecture2 = 4 combinations
		expect(result.combinations).toHaveLength(4)
		expect(result.hitLimit).toBe(false)
	})

	it('filters out conflicting combinations', () => {
		const lecture1 = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const lecture2 = makeLecture('MAC0121', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]), // conflicts!
			makeClassroom('T2', [makeSchedule('seg', '14:00', '16:00')]), // no conflict
		])

		const result = computeCombinations([
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		])

		// Only 1 valid combination (lecture1-T1 + lecture2-T2)
		expect(result.combinations).toHaveLength(1)
		expect(result.combinations[0].groups).toHaveLength(2)
	})

	it('returns empty when no valid combinations exist', () => {
		const lecture1 = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const lecture2 = makeLecture('MAC0121', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]), // conflicts!
		])

		const result = computeCombinations([
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		])

		expect(result.combinations).toHaveLength(0)
	})

	it('calculates credits correctly', () => {
		const lecture1: LectureData = {
			...makeLecture('MAC0110', [makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])]),
			creditos_aula: 4,
			creditos_trabalho: 2,
		}
		const lecture2: LectureData = {
			...makeLecture('MAC0121', [makeClassroom('T1', [makeSchedule('ter', '10:00', '12:00')])]),
			creditos_aula: 2,
			creditos_trabalho: 1,
		}

		const result = computeCombinations([
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		])

		expect(result.combinations).toHaveLength(1)
		expect(result.combinations[0].lectureCredits).toBe(6) // 4 + 2
		expect(result.combinations[0].workCredits).toBe(3) // 2 + 1
	})

	it('skips lectures with no classroom groups', () => {
		const lecture1 = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const lecture2 = makeLecture('MAC0121', []) // no classrooms

		const result = computeCombinations([
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		])

		// Should still have combinations from lecture1
		expect(result.combinations).toHaveLength(1)
		expect(result.combinations[0].groups).toHaveLength(1)
	})

	it('sets hitLimit when exceeding MAX_COMBINATIONS', () => {
		// Create a scenario that would generate many combinations
		// Each lecture with 10 non-conflicting classrooms = 10^n combinations
		const makeMultiClassroomLecture = (codigo: string, dayOffset: number): LectureData => {
			const classrooms: ClassroomData[] = []
			for (let i = 0; i < 15; i++) {
				const hour = 7 + i
				classrooms.push(
					makeClassroom(`T${i}`, [makeSchedule('seg', `${hour}:00`, `${hour}:50`)])
				)
			}
			return makeLecture(codigo, classrooms)
		}

		// With 4 lectures of 15 classrooms each (all different times),
		// we'd have 15^4 = 50,625 combinations, way over the limit
		const lectures = [
			makePlanLecture(makeMultiClassroomLecture('L1', 0), { color: 1 }),
			makePlanLecture(makeMultiClassroomLecture('L2', 1), { color: 2 }),
			makePlanLecture(makeMultiClassroomLecture('L3', 2), { color: 3 }),
			makePlanLecture(makeMultiClassroomLecture('L4', 3), { color: 4 }),
		]

		const result = computeCombinations(lectures)

		expect(result.hitLimit).toBe(true)
		expect(result.combinations.length).toBeLessThanOrEqual(MAX_COMBINATIONS)
	})
})

describe('findClosestCombination', () => {
	it('returns null for empty combinations', () => {
		expect(findClosestCombination([], null)).toBeNull()
	})

	it('returns first combination when no previous', () => {
		const lecture = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const planLecture = makePlanLecture(lecture)
		const { combinations } = computeCombinations([planLecture])

		const result = findClosestCombination(combinations, null)

		expect(result).toBe(combinations[0])
	})

	it('finds most similar combination', () => {
		const lecture1 = makeLecture('MAC0110', [
			makeClassroom('T1', [makeSchedule('seg', '08:00', '10:00')]),
			makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')]),
		])
		const lecture2 = makeLecture('MAC0121', [
			makeClassroom('T1', [makeSchedule('ter', '08:00', '10:00')]),
			makeClassroom('T2', [makeSchedule('ter', '10:00', '12:00')]),
		])

		const planLectures = [
			makePlanLecture(lecture1, { color: 1 }),
			makePlanLecture(lecture2, { color: 2 }),
		]
		const { combinations } = computeCombinations(planLectures)

		// Find a specific combination
		const targetCombination = combinations.find((c) =>
			c.groups.some((g) => g.classrooms[0].codigo === 'T2' && g.lecture.data.codigo === 'MAC0110')
		)

		const result = findClosestCombination(combinations, targetCombination!)

		// Should find the same or equivalent combination
		expect(result).not.toBeNull()
		const foundGroup = result!.groups.find((g) => g.lecture.data.codigo === 'MAC0110')
		expect(foundGroup?.classrooms[0].codigo).toBe('T2')
	})
})

describe('MAX_COMBINATIONS constant', () => {
	it('is set to 1000', () => {
		expect(MAX_COMBINATIONS).toBe(1000)
	})
})
