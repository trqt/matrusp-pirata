<script lang="ts">
	import type { Combination } from '~/lib/services/combination'
	import { parseTime } from '~/lib/models/types'
	import { getColorHex } from '~/lib/utils/color'

	interface Props {
		combination: Combination
		isActive?: boolean
		onclick?: () => void
	}

	let { combination, isActive = false, onclick }: Props = $props()

	let canvas: HTMLCanvasElement | undefined = $state()

	// Time grid settings (8h to 23h)
	const startHour = 8
	const endHour = 23
	const totalHours = endHour - startHour
	const dayCount = 5 // seg-sex

	// Draw the combination preview on canvas
	$effect(() => {
		if (!canvas) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const scale = window.devicePixelRatio || 1
		const width = canvas.width
		const height = canvas.height

		// Clear canvas
		ctx.clearRect(0, 0, width, height)

		// Draw background grid lines (subtle)
		ctx.strokeStyle = isActive ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)'
		ctx.lineWidth = 1 * scale

		// Vertical lines (day separators)
		for (let i = 1; i < dayCount; i++) {
			const x = (i / dayCount) * width
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, height)
			ctx.stroke()
		}

		// Draw schedule boxes
		for (const group of combination.groups) {
			const classroom = group.classrooms[0]
			const color = getColorHex(group.lecture.color)
			const darkColor = getDarkerColor(color)

			for (const schedule of classroom.horario) {
				const dayIndex = getDayIndex(schedule.dia)
				if (dayIndex < 0 || dayIndex >= dayCount) continue

				const startMinutes = parseTime(schedule.inicio)
				const endMinutes = parseTime(schedule.fim)

				const top = ((startMinutes / 60 - startHour) / totalHours) * height
				const bottom = ((endMinutes / 60 - startHour) / totalHours) * height
				const boxHeight = bottom - top

				const boxLeft = (dayIndex / dayCount) * width + 1 * scale
				const boxWidth = (width / dayCount) - 2 * scale

				// Main fill
				ctx.fillStyle = color
				ctx.fillRect(boxLeft, top, boxWidth, boxHeight)

				// Left accent bar
				ctx.fillStyle = darkColor
				ctx.fillRect(boxLeft, top, 2 * scale, boxHeight)
			}
		}
	})

	// Day index mapping
	function getDayIndex(dia: string): number {
		const days: Record<string, number> = {
			seg: 0,
			ter: 1,
			qua: 2,
			qui: 3,
			sex: 4,
			sab: 5,
			dom: 6,
		}
		return days[dia] ?? -1
	}

	// Darken a hex color
	function getDarkerColor(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16)
		const g = parseInt(hex.slice(3, 5), 16)
		const b = parseInt(hex.slice(5, 7), 16)

		const factor = 0.7
		const dr = Math.round(r * factor)
		const dg = Math.round(g * factor)
		const db = Math.round(b * factor)

		return `rgb(${dr},${dg},${db})`
	}
</script>

<button
	type="button"
	class="shrink-0 border-2 transition-all
		{isActive
			? 'border-black dark:border-white scale-105'
			: 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'}"
	{onclick}
	title="{combination.lectureCredits + combination.workCredits} créditos"
>
	<canvas
		bind:this={canvas}
		width={100}
		height={100}
		class="w-[50px] h-[50px] block"
	></canvas>
</button>
