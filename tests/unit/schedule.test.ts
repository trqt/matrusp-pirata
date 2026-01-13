import { describe, it, expect } from 'vitest'
import {
	timeRangesOverlap,
	schedulesConflict,
	dateRangesOverlap,
	classroomsConflict,
	getClassroomTeachers,
	formatSchedule,
	getSchedulePeriod,
	classroomInPeriod,
	sortSchedules,
	getShortCode,
	calculateSchedulePosition,
	generateHourLabels,
	getDayIndex,
	DEFAULT_TIME_RANGE,
} from '~/lib/utils/schedule'
import type { ScheduleData, ClassroomData, DayOfWeek } from '~/lib/models/types'

// Helper to create schedule data
function makeSchedule(
	dia: DayOfWeek,
	inicio: string,
	fim: string,
	professores: string[] = []
): ScheduleData {
	return { dia, inicio, fim, professores }
}

// Helper to create classroom data
function makeClassroom(
	codigo: string,
	horario: ScheduleData[],
	options: Partial<ClassroomData> = {}
): ClassroomData {
	return {
		codigo,
		tipo: 'Teórica',
		inicio: '01/03/2025',
		fim: '30/06/2025',
		horario,
		vagas: {},
		...options,
	}
}

describe('timeRangesOverlap', () => {
	it('returns true for overlapping ranges', () => {
		// 10:00-12:00 and 11:00-13:00
		expect(timeRangesOverlap(600, 720, 660, 780)).toBe(true)
	})

	it('returns true for contained ranges', () => {
		// 10:00-14:00 contains 11:00-13:00
		expect(timeRangesOverlap(600, 840, 660, 780)).toBe(true)
		expect(timeRangesOverlap(660, 780, 600, 840)).toBe(true)
	})

	it('returns true for identical ranges', () => {
		expect(timeRangesOverlap(600, 720, 600, 720)).toBe(true)
	})

	it('returns false for adjacent ranges (no overlap)', () => {
		// 10:00-12:00 and 12:00-14:00 (touching at boundary)
		expect(timeRangesOverlap(600, 720, 720, 840)).toBe(false)
	})

	it('returns false for separate ranges', () => {
		// 08:00-10:00 and 14:00-16:00
		expect(timeRangesOverlap(480, 600, 840, 960)).toBe(false)
	})
})

describe('schedulesConflict', () => {
	it('returns true for same day overlapping times', () => {
		const s1 = makeSchedule('seg', '10:00', '12:00')
		const s2 = makeSchedule('seg', '11:00', '13:00')
		expect(schedulesConflict(s1, s2)).toBe(true)
	})

	it('returns false for different days', () => {
		const s1 = makeSchedule('seg', '10:00', '12:00')
		const s2 = makeSchedule('ter', '10:00', '12:00')
		expect(schedulesConflict(s1, s2)).toBe(false)
	})

	it('returns false for same day non-overlapping times', () => {
		const s1 = makeSchedule('seg', '08:00', '10:00')
		const s2 = makeSchedule('seg', '14:00', '16:00')
		expect(schedulesConflict(s1, s2)).toBe(false)
	})

	it('returns false for adjacent times (no gap)', () => {
		const s1 = makeSchedule('seg', '10:00', '12:00')
		const s2 = makeSchedule('seg', '12:00', '14:00')
		expect(schedulesConflict(s1, s2)).toBe(false)
	})
})

describe('dateRangesOverlap', () => {
	it('returns true for overlapping date ranges', () => {
		expect(dateRangesOverlap('01/03/2025', '30/06/2025', '01/05/2025', '30/08/2025')).toBe(true)
	})

	it('returns true for contained date ranges', () => {
		expect(dateRangesOverlap('01/03/2025', '30/06/2025', '01/04/2025', '31/05/2025')).toBe(true)
	})

	it('returns false for separate date ranges', () => {
		expect(dateRangesOverlap('01/03/2025', '30/06/2025', '01/08/2025', '30/11/2025')).toBe(false)
	})

	it('returns false for adjacent date ranges', () => {
		expect(dateRangesOverlap('01/03/2025', '30/06/2025', '30/06/2025', '30/09/2025')).toBe(false)
	})
})

describe('classroomsConflict', () => {
	it('returns true for classrooms with conflicting schedules', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [makeSchedule('seg', '11:00', '13:00')])
		expect(classroomsConflict(c1, c2)).toBe(true)
	})

	it('returns false for classrooms with non-conflicting schedules', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '08:00', '10:00')])
		const c2 = makeClassroom('T2', [makeSchedule('seg', '14:00', '16:00')])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('returns false for classrooms on different days', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [makeSchedule('ter', '10:00', '12:00')])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('returns false for classrooms with non-overlapping date ranges', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')], {
			inicio: '01/03/2025',
			fim: '30/04/2025',
		})
		const c2 = makeClassroom('T2', [makeSchedule('seg', '10:00', '12:00')], {
			inicio: '01/06/2025',
			fim: '30/07/2025',
		})
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('returns false for classroom with empty schedule', () => {
		const c1 = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00')])
		const c2 = makeClassroom('T2', [])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('returns false when both have empty schedules', () => {
		const c1 = makeClassroom('T1', [])
		const c2 = makeClassroom('T2', [])
		expect(classroomsConflict(c1, c2)).toBe(false)
	})

	it('handles multiple schedules per classroom', () => {
		const c1 = makeClassroom('T1', [
			makeSchedule('seg', '08:00', '10:00'),
			makeSchedule('qua', '08:00', '10:00'),
		])
		const c2 = makeClassroom('T2', [
			makeSchedule('ter', '14:00', '16:00'),
			makeSchedule('qua', '09:00', '11:00'), // conflicts with c1's qua schedule
		])
		expect(classroomsConflict(c1, c2)).toBe(true)
	})
})

describe('getClassroomTeachers', () => {
	it('returns deduplicated teachers from schedules', () => {
		const classroom = makeClassroom('T1', [
			makeSchedule('seg', '10:00', '12:00', ['Prof A', 'Prof B']),
			makeSchedule('qua', '10:00', '12:00', ['Prof A', 'Prof C']),
		])
		const teachers = getClassroomTeachers(classroom)
		expect(teachers).toHaveLength(3)
		expect(teachers).toContain('Prof A')
		expect(teachers).toContain('Prof B')
		expect(teachers).toContain('Prof C')
	})

	it('filters out empty/short names', () => {
		const classroom = makeClassroom('T1', [
			makeSchedule('seg', '10:00', '12:00', ['Prof A', '', 'X']),
		])
		const teachers = getClassroomTeachers(classroom)
		expect(teachers).toEqual(['Prof A'])
	})

	it('returns empty array for no teachers', () => {
		const classroom = makeClassroom('T1', [makeSchedule('seg', '10:00', '12:00', [])])
		expect(getClassroomTeachers(classroom)).toEqual([])
	})
})

describe('formatSchedule', () => {
	it('formats schedule with day abbreviation', () => {
		expect(formatSchedule(makeSchedule('seg', '10:00', '12:00'))).toBe('Seg 10:00-12:00')
		expect(formatSchedule(makeSchedule('ter', '14:30', '16:30'))).toBe('Ter 14:30-16:30')
		expect(formatSchedule(makeSchedule('sab', '08:00', '10:00'))).toBe('Sáb 08:00-10:00')
	})
})

describe('getSchedulePeriod', () => {
	it('returns matutino for morning times', () => {
		expect(getSchedulePeriod(makeSchedule('seg', '07:00', '09:00'))).toBe('matutino')
		expect(getSchedulePeriod(makeSchedule('seg', '10:00', '12:00'))).toBe('matutino')
		expect(getSchedulePeriod(makeSchedule('seg', '11:59', '14:00'))).toBe('matutino')
	})

	it('returns vespertino for afternoon times', () => {
		expect(getSchedulePeriod(makeSchedule('seg', '12:00', '14:00'))).toBe('vespertino')
		expect(getSchedulePeriod(makeSchedule('seg', '14:00', '16:00'))).toBe('vespertino')
		expect(getSchedulePeriod(makeSchedule('seg', '17:59', '20:00'))).toBe('vespertino')
	})

	it('returns noturno for evening times', () => {
		expect(getSchedulePeriod(makeSchedule('seg', '18:00', '20:00'))).toBe('noturno')
		expect(getSchedulePeriod(makeSchedule('seg', '19:30', '21:30'))).toBe('noturno')
		expect(getSchedulePeriod(makeSchedule('seg', '21:00', '23:00'))).toBe('noturno')
	})
})

describe('classroomInPeriod', () => {
	it('returns true if any schedule is in the period', () => {
		const classroom = makeClassroom('T1', [
			makeSchedule('seg', '08:00', '10:00'), // matutino
			makeSchedule('ter', '19:00', '21:00'), // noturno
		])
		expect(classroomInPeriod(classroom, 'matutino')).toBe(true)
		expect(classroomInPeriod(classroom, 'noturno')).toBe(true)
		expect(classroomInPeriod(classroom, 'vespertino')).toBe(false)
	})
})

describe('sortSchedules', () => {
	it('sorts by day then by time', () => {
		const schedules = [
			makeSchedule('qua', '14:00', '16:00'),
			makeSchedule('seg', '10:00', '12:00'),
			makeSchedule('seg', '08:00', '10:00'),
			makeSchedule('ter', '10:00', '12:00'),
		]
		const sorted = sortSchedules(schedules)
		expect(sorted[0].dia).toBe('seg')
		expect(sorted[0].inicio).toBe('08:00')
		expect(sorted[1].dia).toBe('seg')
		expect(sorted[1].inicio).toBe('10:00')
		expect(sorted[2].dia).toBe('ter')
		expect(sorted[3].dia).toBe('qua')
	})

	it('does not mutate original array', () => {
		const schedules = [
			makeSchedule('ter', '10:00', '12:00'),
			makeSchedule('seg', '08:00', '10:00'),
		]
		const sorted = sortSchedules(schedules)
		expect(schedules[0].dia).toBe('ter')
		expect(sorted[0].dia).toBe('seg')
	})
})

describe('getShortCode', () => {
	it('returns last 2 characters', () => {
		expect(getShortCode('2025101')).toBe('01')
		expect(getShortCode('MAC0110-T1')).toBe('T1')
		expect(getShortCode('AB')).toBe('AB')
	})
})

describe('calculateSchedulePosition', () => {
	it('calculates position for schedule at start of grid', () => {
		const pos = calculateSchedulePosition('07:00', '08:00', 7, 23)
		expect(pos.top).toBe(0)
		// 1 hour out of 16 hours = 6.25%
		expect(pos.height).toBeCloseTo(6.25, 1)
	})

	it('calculates position for schedule in middle of grid', () => {
		const pos = calculateSchedulePosition('15:00', '17:00', 7, 23)
		// 15:00 is 8 hours from 07:00, so 8/16 = 50%
		expect(pos.top).toBeCloseTo(50, 1)
		// 2 hours out of 16 = 12.5%
		expect(pos.height).toBeCloseTo(12.5, 1)
	})

	it('clamps negative values to 0', () => {
		const pos = calculateSchedulePosition('06:00', '07:00', 7, 23)
		expect(pos.top).toBe(0)
	})

	it('uses default time range', () => {
		const pos = calculateSchedulePosition('07:00', '08:00')
		expect(pos.top).toBe(0)
		expect(pos.height).toBeGreaterThan(0)
	})
})

describe('generateHourLabels', () => {
	it('generates labels for default range', () => {
		const labels = generateHourLabels()
		expect(labels[0]).toBe('07:00')
		expect(labels[labels.length - 1]).toBe('23:00')
		expect(labels).toHaveLength(17) // 7 to 23 inclusive
	})

	it('generates labels for custom range', () => {
		const labels = generateHourLabels(8, 12)
		expect(labels).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00'])
	})
})

describe('getDayIndex', () => {
	it('returns correct index for each day', () => {
		expect(getDayIndex('seg')).toBe(0)
		expect(getDayIndex('ter')).toBe(1)
		expect(getDayIndex('qua')).toBe(2)
		expect(getDayIndex('qui')).toBe(3)
		expect(getDayIndex('sex')).toBe(4)
		expect(getDayIndex('sab')).toBe(5)
		expect(getDayIndex('dom')).toBe(6)
	})
})

describe('DEFAULT_TIME_RANGE', () => {
	it('has expected values', () => {
		expect(DEFAULT_TIME_RANGE.startHour).toBe(7)
		expect(DEFAULT_TIME_RANGE.endHour).toBe(23)
	})
})
