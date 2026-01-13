import { describe, it, expect } from 'vitest'
import { parseTime, formatTime, DAY_NAMES, DAYS_ORDERED, TIME_PERIODS } from '~/lib/models/types'

describe('parseTime', () => {
	it('parses midnight correctly', () => {
		expect(parseTime('00:00')).toBe(0)
	})

	it('parses morning time correctly', () => {
		expect(parseTime('08:30')).toBe(8 * 60 + 30)
		expect(parseTime('10:00')).toBe(600)
	})

	it('parses afternoon time correctly', () => {
		expect(parseTime('14:45')).toBe(14 * 60 + 45)
		expect(parseTime('18:00')).toBe(1080)
	})

	it('parses evening time correctly', () => {
		expect(parseTime('21:30')).toBe(21 * 60 + 30)
		expect(parseTime('23:59')).toBe(23 * 60 + 59)
	})

	it('handles single-digit hours and minutes', () => {
		expect(parseTime('7:05')).toBe(7 * 60 + 5)
		expect(parseTime('9:00')).toBe(540)
	})
})

describe('formatTime', () => {
	it('formats midnight correctly', () => {
		expect(formatTime(0)).toBe('00:00')
	})

	it('formats morning time correctly', () => {
		expect(formatTime(510)).toBe('08:30')
		expect(formatTime(600)).toBe('10:00')
	})

	it('formats afternoon time correctly', () => {
		expect(formatTime(885)).toBe('14:45')
		expect(formatTime(1080)).toBe('18:00')
	})

	it('formats evening time correctly', () => {
		expect(formatTime(1290)).toBe('21:30')
		expect(formatTime(1439)).toBe('23:59')
	})

	it('pads single-digit hours and minutes', () => {
		expect(formatTime(65)).toBe('01:05')
		expect(formatTime(540)).toBe('09:00')
	})
})

describe('parseTime and formatTime roundtrip', () => {
	const testTimes = ['00:00', '08:30', '12:00', '14:45', '18:00', '21:30', '23:59']

	it('roundtrips correctly', () => {
		for (const time of testTimes) {
			expect(formatTime(parseTime(time))).toBe(time)
		}
	})
})

describe('DAY_NAMES', () => {
	it('has all 7 days', () => {
		expect(Object.keys(DAY_NAMES)).toHaveLength(7)
	})

	it('maps short codes to full names', () => {
		expect(DAY_NAMES.seg).toBe('Segunda')
		expect(DAY_NAMES.ter).toBe('Terça')
		expect(DAY_NAMES.qua).toBe('Quarta')
		expect(DAY_NAMES.qui).toBe('Quinta')
		expect(DAY_NAMES.sex).toBe('Sexta')
		expect(DAY_NAMES.sab).toBe('Sábado')
		expect(DAY_NAMES.dom).toBe('Domingo')
	})
})

describe('DAYS_ORDERED', () => {
	it('has 7 days in correct order', () => {
		expect(DAYS_ORDERED).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])
	})
})

describe('TIME_PERIODS', () => {
	it('has all 3 periods', () => {
		expect(Object.keys(TIME_PERIODS)).toHaveLength(3)
	})

	it('has correct labels', () => {
		expect(TIME_PERIODS.matutino.label).toBe('Matutino')
		expect(TIME_PERIODS.vespertino.label).toBe('Vespertino')
		expect(TIME_PERIODS.noturno.label).toBe('Noturno')
	})

	it('has non-overlapping time ranges', () => {
		expect(TIME_PERIODS.matutino.end).toBe(TIME_PERIODS.vespertino.start)
		expect(TIME_PERIODS.vespertino.end).toBe(TIME_PERIODS.noturno.start)
	})
})
