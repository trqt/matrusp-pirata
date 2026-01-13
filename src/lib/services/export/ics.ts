/**
 * ICS Calendar Export
 * Generates iCalendar (.ics) files for schedule export
 */

import type { PlanLecture, ClassroomData, ScheduleData, DayOfWeek } from '~/lib/models/types'
import type { Combination } from '~/lib/services/combination'

const ICS_HEADER = [
	'BEGIN:VCALENDAR',
	'PRODID:-//MatrUSP//MatrUSP Calendar//PT',
	'VERSION:2.0',
	'CALSCALE:GREGORIAN',
	'METHOD:PUBLISH',
].join('\r\n')

const ICS_FOOTER = 'END:VCALENDAR'

/** Map day abbreviation to iCal day code */
const DAY_TO_ICAL: Record<DayOfWeek, string> = {
	dom: 'SU',
	seg: 'MO',
	ter: 'TU',
	qua: 'WE',
	qui: 'TH',
	sex: 'FR',
	sab: 'SA',
}

/** Map day abbreviation to JS day number (0 = Sunday) */
const DAY_TO_NUMBER: Record<DayOfWeek, number> = {
	dom: 0,
	seg: 1,
	ter: 2,
	qua: 3,
	qui: 4,
	sex: 5,
	sab: 6,
}

/** Generate a unique ID for an event */
function generateUID(lectureCode: string, classroomCode: string, day: DayOfWeek): string {
	const timestamp = Date.now()
	return `${lectureCode}-${classroomCode}-${day}-${timestamp}@matrusp`
}

/** Get current UTC timestamp in iCal format */
function getICalTimestamp(): string {
	return new Date()
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '')
}

/** Parse DD/MM/YYYY date string to Date */
function parseDate(dateStr: string): Date {
	const [day, month, year] = dateStr.split('/').map(Number)
	return new Date(year, month - 1, day)
}

/** Parse HH:MM time string to hours and minutes */
function parseTime(timeStr: string): { hours: number; minutes: number } {
	const [hours, minutes] = timeStr.split(':').map(Number)
	return { hours, minutes }
}

/** Format date to iCal format (YYYYMMDD) */
function formatICalDate(date: Date): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}${month}${day}`
}

/** Format date and time to iCal format (YYYYMMDDTHHMMSS) */
function formatICalDateTime(date: Date, time: { hours: number; minutes: number }): string {
	const dateStr = formatICalDate(date)
	const hours = String(time.hours).padStart(2, '0')
	const minutes = String(time.minutes).padStart(2, '0')
	return `${dateStr}T${hours}${minutes}00`
}

/** Find the first occurrence of a weekday on or after a given date */
function findFirstOccurrence(startDate: Date, targetDay: number): Date {
	const result = new Date(startDate)
	const currentDay = result.getDay()
	const daysUntilTarget = (targetDay - currentDay + 7) % 7
	result.setDate(result.getDate() + daysUntilTarget)
	return result
}

/** Escape special characters for iCal text */
function escapeICalText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n')
}

/** Build an iCal event for a schedule */
function buildEvent(
	lecture: PlanLecture,
	classroom: ClassroomData,
	schedule: ScheduleData
): string {
	const startDate = parseDate(classroom.inicio)
	const endDate = parseDate(classroom.fim)
	const startTime = parseTime(schedule.inicio)
	const endTime = parseTime(schedule.fim)
	const dayNumber = DAY_TO_NUMBER[schedule.dia]
	const dayCode = DAY_TO_ICAL[schedule.dia]

	// Find the first class date for this weekday
	const firstClassDate = findFirstOccurrence(startDate, dayNumber)

	// Get teachers from schedule or classroom
	const teachers = schedule.professores?.length
		? schedule.professores.join(', ')
		: 'Professor não definido'

	const summary = `${lecture.data.nome} (${lecture.data.codigo})`
	const description = `Turma: ${classroom.codigo}\\nProfessor(es): ${escapeICalText(teachers)}${
		classroom.observacoes ? `\\nObs: ${escapeICalText(classroom.observacoes)}` : ''
	}`

	const lines = [
		'BEGIN:VEVENT',
		`UID:${generateUID(lecture.data.codigo, classroom.codigo, schedule.dia)}`,
		`DTSTAMP:${getICalTimestamp()}`,
		`DTSTART;TZID=America/Sao_Paulo:${formatICalDateTime(firstClassDate, startTime)}`,
		`DTEND;TZID=America/Sao_Paulo:${formatICalDateTime(firstClassDate, endTime)}`,
		`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${formatICalDate(endDate)}T235959`,
		`SUMMARY:${escapeICalText(summary)}`,
		`DESCRIPTION:${description}`,
		'STATUS:CONFIRMED',
		'TRANSP:OPAQUE',
		'END:VEVENT',
	]

	return lines.join('\r\n')
}

/** Generate ICS content for the current combination */
export function generateICS(
	lectures: PlanLecture[],
	combination: Combination | null
): string | null {
	if (!combination) return null

	const events: string[] = []

	for (const group of combination.groups) {
		const lecture = group.lecture
		if (!lecture.selected) continue

		// Use first classroom in group (they all have same schedule)
		const classroom = group.classrooms[0]
		if (!classroom) continue

		for (const schedule of classroom.horario) {
			events.push(buildEvent(lecture, classroom, schedule))
		}
	}

	if (events.length === 0) return null

	return [ICS_HEADER, ...events, ICS_FOOTER].join('\r\n')
}

/** Download the ICS file */
export function downloadICS(lectures: PlanLecture[], combination: Combination | null): boolean {
	const content = generateICS(lectures, combination)
	if (!content) return false

	const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
	const url = URL.createObjectURL(blob)

	const link = document.createElement('a')
	link.href = url
	link.download = 'matrusp_calendario.ics'
	link.style.display = 'none'

	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)

	URL.revokeObjectURL(url)
	return true
}
