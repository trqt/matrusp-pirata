/**
 * Schedule utility functions for time parsing and conflict detection
 */

import type { ScheduleData, ClassroomData, DayOfWeek } from '~/lib/models/types'
import { parseTime } from '~/lib/models/types'

/**
 * Check if two time ranges overlap
 * @param start1 Start time in minutes from midnight
 * @param end1 End time in minutes from midnight
 * @param start2 Start time in minutes from midnight
 * @param end2 End time in minutes from midnight
 */
export function timeRangesOverlap(
	start1: number,
	end1: number,
	start2: number,
	end2: number
): boolean {
	return start1 < end2 && end1 > start2
}

/**
 * Check if two schedules conflict (same day and overlapping times)
 */
export function schedulesConflict(s1: ScheduleData, s2: ScheduleData): boolean {
	if (s1.dia !== s2.dia) return false

	const start1 = parseTime(s1.inicio)
	const end1 = parseTime(s1.fim)
	const start2 = parseTime(s2.inicio)
	const end2 = parseTime(s2.fim)

	return timeRangesOverlap(start1, end1, start2, end2)
}

/**
 * Check if two date ranges overlap (DD/MM/YYYY format)
 */
export function dateRangesOverlap(
	start1: string,
	end1: string,
	start2: string,
	end2: string
): boolean {
	const parseDate = (d: string): Date => {
		const [day, month, year] = d.split('/').map(Number)
		return new Date(year, month - 1, day)
	}

	const d1Start = parseDate(start1)
	const d1End = parseDate(end1)
	const d2Start = parseDate(start2)
	const d2End = parseDate(end2)

	return d1Start < d2End && d1End > d2Start
}

/**
 * Check if two classrooms conflict
 * Classrooms conflict if their date ranges overlap AND any of their schedules conflict
 */
export function classroomsConflict(c1: ClassroomData, c2: ClassroomData): boolean {
	// Guard against missing data
	if (!c1.horario?.length || !c2.horario?.length) {
		return false
	}

	// Check date range overlap first (if dates are available)
	if (c1.inicio && c1.fim && c2.inicio && c2.fim) {
		if (!dateRangesOverlap(c1.inicio, c1.fim, c2.inicio, c2.fim)) {
			return false
		}
	}

	// Check schedule conflicts
	return c1.horario.some((s1) => c2.horario.some((s2) => schedulesConflict(s1, s2)))
}

/**
 * Get all teachers from a classroom's schedules (deduplicated)
 */
export function getClassroomTeachers(classroom: ClassroomData): string[] {
	const teachers = new Set<string>()
	for (const schedule of classroom.horario) {
		for (const teacher of schedule.professores) {
			if (teacher && teacher.length > 1) {
				teachers.add(teacher)
			}
		}
	}
	return Array.from(teachers)
}

/**
 * Get total vacancies for a classroom
 */
export function getTotalVacancies(classroom: ClassroomData): {
	total: number
	inscribed: number
	pending: number
	enrolled: number
} {
	let total = 0
	let inscribed = 0
	let pending = 0
	let enrolled = 0

	for (const vacancy of Object.values(classroom.vagas)) {
		total += vacancy.vagas
		inscribed += vacancy.inscritos
		pending += vacancy.pendentes
		enrolled += vacancy.matriculados
	}

	return { total, inscribed, pending, enrolled }
}

/**
 * Format a schedule for display (e.g., "Seg 10:00-11:40")
 */
export function formatSchedule(schedule: ScheduleData): string {
	const dayAbbrev: Record<DayOfWeek, string> = {
		seg: 'Seg',
		ter: 'Ter',
		qua: 'Qua',
		qui: 'Qui',
		sex: 'Sex',
		sab: 'Sáb',
		dom: 'Dom',
	}
	return `${dayAbbrev[schedule.dia]} ${schedule.inicio}-${schedule.fim}`
}

/**
 * Group schedules by day for display
 */
export function groupSchedulesByDay(
	schedules: ScheduleData[]
): Map<DayOfWeek, ScheduleData[]> {
	const grouped = new Map<DayOfWeek, ScheduleData[]>()

	for (const schedule of schedules) {
		const existing = grouped.get(schedule.dia) ?? []
		existing.push(schedule)
		grouped.set(schedule.dia, existing)
	}

	return grouped
}

/**
 * Get the time period for a schedule (matutino/vespertino/noturno)
 */
export function getSchedulePeriod(schedule: ScheduleData): 'matutino' | 'vespertino' | 'noturno' {
	const startMinutes = parseTime(schedule.inicio)
	const morningEnd = 12 * 60 // 12:00
	const afternoonEnd = 18 * 60 // 18:00

	if (startMinutes < morningEnd) return 'matutino'
	if (startMinutes < afternoonEnd) return 'vespertino'
	return 'noturno'
}

/**
 * Check if a classroom has schedules in a given period
 */
export function classroomInPeriod(
	classroom: ClassroomData,
	period: 'matutino' | 'vespertino' | 'noturno'
): boolean {
	return classroom.horario.some((s) => getSchedulePeriod(s) === period)
}

/**
 * Sort schedules by day and time
 */
export function sortSchedules(schedules: ScheduleData[]): ScheduleData[] {
	const dayOrder: Record<DayOfWeek, number> = {
		seg: 0,
		ter: 1,
		qua: 2,
		qui: 3,
		sex: 4,
		sab: 5,
		dom: 6,
	}

	return [...schedules].sort((a, b) => {
		const dayDiff = dayOrder[a.dia] - dayOrder[b.dia]
		if (dayDiff !== 0) return dayDiff
		return parseTime(a.inicio) - parseTime(b.inicio)
	})
}

/**
 * Get the short code from a classroom code (last 2 digits)
 */
export function getShortCode(codigo: string): string {
	return codigo.slice(-2)
}

// ============================================
// Schedule Positioning for TimeTable
// ============================================

/** Default time range for the schedule grid (7:00 to 23:00) */
export const DEFAULT_TIME_RANGE = {
	startHour: 7,
	endHour: 23,
}

/**
 * Calculate the position of a schedule box as percentages
 * @param startTime Start time in "HH:MM" format
 * @param endTime End time in "HH:MM" format
 * @param gridStartHour The hour the grid starts (default 7)
 * @param gridEndHour The hour the grid ends (default 23)
 * @returns { top: percentage, height: percentage }
 */
export function calculateSchedulePosition(
	startTime: string,
	endTime: string,
	gridStartHour = DEFAULT_TIME_RANGE.startHour,
	gridEndHour = DEFAULT_TIME_RANGE.endHour
): { top: number; height: number } {
	const startMinutes = parseTime(startTime)
	const endMinutes = parseTime(endTime)

	const gridStartMinutes = gridStartHour * 60
	const gridEndMinutes = gridEndHour * 60
	const gridTotalMinutes = gridEndMinutes - gridStartMinutes

	const top = ((startMinutes - gridStartMinutes) / gridTotalMinutes) * 100
	const height = ((endMinutes - startMinutes) / gridTotalMinutes) * 100

	return { top: Math.max(0, top), height: Math.max(0, height) }
}

/**
 * Generate hour labels for the time column
 * @param startHour First hour to show
 * @param endHour Last hour to show
 * @returns Array of hour strings
 */
export function generateHourLabels(
	startHour = DEFAULT_TIME_RANGE.startHour,
	endHour = DEFAULT_TIME_RANGE.endHour
): string[] {
	const hours: string[] = []
	for (let h = startHour; h <= endHour; h++) {
		hours.push(`${h.toString().padStart(2, '0')}:00`)
	}
	return hours
}

/**
 * Get the index of a day (0 = seg, 1 = ter, etc.)
 */
export function getDayIndex(day: DayOfWeek): number {
	const dayOrder: Record<DayOfWeek, number> = {
		seg: 0,
		ter: 1,
		qua: 2,
		qui: 3,
		sex: 4,
		sab: 5,
		dom: 6,
	}
	return dayOrder[day]
}
