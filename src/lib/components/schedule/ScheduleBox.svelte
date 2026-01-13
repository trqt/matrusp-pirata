<script lang="ts">
	import type { ScheduleData, ScheduleColor } from '~/lib/models/types'
	import { parseTime } from '~/lib/models/types'
	import { getColorClasses } from '~/lib/utils/color'

	interface Props {
		schedule: ScheduleData
		lectureCode: string
		lectureName: string
		classroomCode?: string
		color: ScheduleColor
		startHour: number
		endHour: number
		isActive?: boolean
		isHighlighted?: boolean
		isConflict?: boolean
		onmouseenter?: () => void
		onmouseleave?: () => void
		onclick?: () => void
	}

	let {
		schedule,
		lectureCode,
		lectureName,
		classroomCode,
		color,
		startHour,
		endHour,
		isActive = false,
		isHighlighted = false,
		isConflict = false,
		onmouseenter,
		onmouseleave,
		onclick,
	}: Props = $props()

	// Calculate position as percentage
	let position = $derived.by(() => {
		const startMinutes = parseTime(schedule.inicio)
		const endMinutes = parseTime(schedule.fim)
		const gridStartMinutes = startHour * 60
		const gridEndMinutes = endHour * 60
		const gridTotalMinutes = gridEndMinutes - gridStartMinutes

		const top = ((startMinutes - gridStartMinutes) / gridTotalMinutes) * 100
		const height = ((endMinutes - startMinutes) / gridTotalMinutes) * 100

		return { top: Math.max(0, top), height: Math.max(0, height) }
	})

	// Determine if the box is small (1 hour or less)
	let isSmall = $derived.by(() => {
		const [startH, startM] = schedule.inicio.split(':').map(Number)
		const [endH, endM] = schedule.fim.split(':').map(Number)
		const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
		return durationMinutes <= 60
	})
</script>

{#if isActive}
	<div
		class="absolute left-0.5 right-0.5 box-border flex flex-col items-center justify-center
			text-xs select-none overflow-hidden
			border-l-4 transition-colors duration-100
			{getColorClasses(color)}
			{isHighlighted ? 'z-10 shadow-lg' : 'shadow-sm'}
			{isConflict ? 'bg-red-500 border-red-800 text-white opacity-80 z-10' : ''}"
		style="top: {position.top}%; height: {position.height}%;"
		title="{lectureCode} - {lectureName}"
		role="button"
		tabindex="0"
		{onmouseenter}
		{onmouseleave}
		{onclick}
		onkeydown={(e) => e.key === 'Enter' && onclick?.()}
	>
		<!-- Time labels -->
		{#if !isSmall}
			<span class="absolute top-0 left-1 text-[9px] opacity-70">
				{schedule.inicio}
			</span>
		{/if}

		<!-- Lecture code -->
		<span class="font-bold text-center leading-tight px-0.5 truncate max-w-full text-[11px]">
			{lectureCode}
		</span>

		{#if !isSmall}
			<span class="absolute bottom-0 right-1 text-[9px] opacity-70">
				{schedule.fim}
			</span>
		{/if}
	</div>
{/if}
