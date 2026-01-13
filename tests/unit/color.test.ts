import { describe, it, expect } from 'vitest'
import {
	SCHEDULE_COLOR_MAP,
	getColorClasses,
	getBgClass,
	getBorderClass,
	getColorName,
	getColorHex,
	getColorDotClasses,
} from '~/lib/utils/color'
import type { ScheduleColor } from '~/lib/models/types'

describe('SCHEDULE_COLOR_MAP', () => {
	it('has all 8 colors', () => {
		expect(Object.keys(SCHEDULE_COLOR_MAP)).toHaveLength(8)
	})

	it('each color has required properties', () => {
		const colors: ScheduleColor[] = [1, 2, 3, 4, 5, 6, 7, 8]
		for (const color of colors) {
			const entry = SCHEDULE_COLOR_MAP[color]
			expect(entry).toHaveProperty('bg')
			expect(entry).toHaveProperty('border')
			expect(entry).toHaveProperty('text')
			expect(entry).toHaveProperty('name')
			expect(entry).toHaveProperty('hex')
		}
	})

	it('hex values are valid', () => {
		const hexPattern = /^#[0-9a-f]{6}$/i
		const colors: ScheduleColor[] = [1, 2, 3, 4, 5, 6, 7, 8]
		for (const color of colors) {
			expect(SCHEDULE_COLOR_MAP[color].hex).toMatch(hexPattern)
		}
	})

	it('bg classes use Tailwind pattern', () => {
		const colors: ScheduleColor[] = [1, 2, 3, 4, 5, 6, 7, 8]
		for (const color of colors) {
			expect(SCHEDULE_COLOR_MAP[color].bg).toMatch(/^bg-[a-z]+-\d{3}$/)
		}
	})
})

describe('getColorClasses', () => {
	it('returns combined bg, border, and text classes', () => {
		const classes = getColorClasses(1)
		expect(classes).toContain('bg-')
		expect(classes).toContain('border-')
		expect(classes).toContain('text-')
	})

	it('returns different classes for different colors', () => {
		const classes1 = getColorClasses(1)
		const classes2 = getColorClasses(2)
		expect(classes1).not.toBe(classes2)
	})
})

describe('getBgClass', () => {
	it('returns only bg class', () => {
		const bg = getBgClass(1)
		expect(bg).toMatch(/^bg-/)
		expect(bg).not.toContain('border')
		expect(bg).not.toContain('text')
	})

	it('returns correct value from map', () => {
		expect(getBgClass(1)).toBe(SCHEDULE_COLOR_MAP[1].bg)
		expect(getBgClass(5)).toBe(SCHEDULE_COLOR_MAP[5].bg)
	})
})

describe('getBorderClass', () => {
	it('returns only border class', () => {
		const border = getBorderClass(1)
		expect(border).toMatch(/^border-/)
		expect(border).not.toContain('bg-')
	})

	it('returns correct value from map', () => {
		expect(getBorderClass(1)).toBe(SCHEDULE_COLOR_MAP[1].border)
		expect(getBorderClass(8)).toBe(SCHEDULE_COLOR_MAP[8].border)
	})
})

describe('getColorName', () => {
	it('returns Portuguese color names', () => {
		expect(getColorName(1)).toBe('Amarelo')
		expect(getColorName(2)).toBe('Azul')
		expect(getColorName(3)).toBe('Verde')
		expect(getColorName(4)).toBe('Rosa')
		expect(getColorName(5)).toBe('Roxo')
		expect(getColorName(6)).toBe('Laranja')
		expect(getColorName(7)).toBe('Ciano')
		expect(getColorName(8)).toBe('Magenta')
	})
})

describe('getColorHex', () => {
	it('returns hex values', () => {
		const hex = getColorHex(1)
		expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
	})

	it('returns correct value from map', () => {
		expect(getColorHex(1)).toBe(SCHEDULE_COLOR_MAP[1].hex)
		expect(getColorHex(3)).toBe(SCHEDULE_COLOR_MAP[3].hex)
	})
})

describe('getColorDotClasses', () => {
	it('includes size and rounded classes', () => {
		const classes = getColorDotClasses(1)
		expect(classes).toContain('w-3')
		expect(classes).toContain('h-3')
		expect(classes).toContain('rounded-full')
	})

	it('includes bg color', () => {
		const classes = getColorDotClasses(1)
		expect(classes).toContain(SCHEDULE_COLOR_MAP[1].bg)
	})
})
