/**
 * Color utilities for schedule display
 * Maps schedule color IDs to CSS classes and color values
 */

import type { ScheduleColor } from '~/lib/models/types'

/**
 * Color palette for schedule items
 * Using distinct, high-contrast colors that work in both light and dark modes
 */
export const SCHEDULE_COLOR_MAP: Record<
	ScheduleColor,
	{ bg: string; border: string; text: string; name: string; hex: string }
> = {
	1: { bg: 'bg-amber-400', border: 'border-amber-600', text: 'text-black', name: 'Amarelo', hex: '#fbbf24' },
	2: { bg: 'bg-sky-400', border: 'border-sky-600', text: 'text-black', name: 'Azul', hex: '#38bdf8' },
	3: { bg: 'bg-emerald-400', border: 'border-emerald-600', text: 'text-black', name: 'Verde', hex: '#34d399' },
	4: { bg: 'bg-rose-400', border: 'border-rose-600', text: 'text-black', name: 'Rosa', hex: '#fb7185' },
	5: { bg: 'bg-violet-400', border: 'border-violet-600', text: 'text-black', name: 'Roxo', hex: '#a78bfa' },
	6: { bg: 'bg-orange-400', border: 'border-orange-600', text: 'text-black', name: 'Laranja', hex: '#fb923c' },
	7: { bg: 'bg-teal-400', border: 'border-teal-600', text: 'text-black', name: 'Ciano', hex: '#2dd4bf' },
	8: { bg: 'bg-fuchsia-400', border: 'border-fuchsia-600', text: 'text-black', name: 'Magenta', hex: '#e879f9' },
}

/**
 * Get Tailwind classes for a schedule color
 */
export function getColorClasses(color: ScheduleColor): string {
	const { bg, border, text } = SCHEDULE_COLOR_MAP[color]
	return `${bg} ${border} ${text}`
}

/**
 * Get background class only
 */
export function getBgClass(color: ScheduleColor): string {
	return SCHEDULE_COLOR_MAP[color].bg
}

/**
 * Get border class only
 */
export function getBorderClass(color: ScheduleColor): string {
	return SCHEDULE_COLOR_MAP[color].border
}

/**
 * Get the color name in Portuguese
 */
export function getColorName(color: ScheduleColor): string {
	return SCHEDULE_COLOR_MAP[color].name
}

/**
 * Get the hex color value (for canvas drawing)
 */
export function getColorHex(color: ScheduleColor): string {
	return SCHEDULE_COLOR_MAP[color].hex
}

/**
 * Color indicator dot component classes
 */
export function getColorDotClasses(color: ScheduleColor): string {
	return `w-3 h-3 rounded-full ${SCHEDULE_COLOR_MAP[color].bg}`
}
