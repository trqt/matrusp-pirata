<script lang="ts">
	import type { PlanLecture, DayOfWeek, ScheduleData, ClassroomData } from '~/lib/models/types'
	import type { Combination } from '~/lib/services/combination'
	import { DAY_NAMES, DAYS_ORDERED } from '~/lib/models/types'
	import ScheduleBox from './ScheduleBox.svelte'

	interface Props {
		lectures: PlanLecture[]
		/** Active combination to display (if null, shows all selected classrooms) */
		activeCombination?: Combination | null
		/** Days to show (default: seg-sex) */
		visibleDays?: DayOfWeek[]
	}

	let {
		lectures,
		activeCombination = null,
		visibleDays = ['seg', 'ter', 'qua', 'qui', 'sex'],
	}: Props = $props()

	// Fixed time range for USP classes (8h to 23h)
	const startHour = 8
	const endHour = 23
	const totalHours = endHour - startHour

	// Generate hour labels for grid lines (8, 9, 10, ..., 23)
	const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

	// Build schedule items grouped by day
	interface ScheduleItem {
		schedule: ScheduleData
		classroom: ClassroomData
		lecture: PlanLecture
		isActive: boolean
	}

	let schedulesByDay = $derived.by(() => {
		const byDay = new Map<DayOfWeek, ScheduleItem[]>()

		// Initialize empty arrays for each day
		for (const day of DAYS_ORDERED) {
			byDay.set(day, [])
		}

		// If we have an active combination, show only those classrooms
		if (activeCombination) {
			for (const group of activeCombination.groups) {
				const classroom = group.classrooms[0]
				const lecture = group.lecture

				if (!classroom?.horario) continue

				for (const schedule of classroom.horario) {
					const daySchedules = byDay.get(schedule.dia)
					if (daySchedules) {
						daySchedules.push({
							schedule,
							classroom,
							lecture,
							isActive: true,
						})
					}
				}
			}
		} else {
			// No combination - show all selected lectures/classrooms
			for (const lecture of lectures) {
				if (!lecture.selected) continue
				if (!lecture.data.turmas) continue

				for (const classroom of lecture.data.turmas) {
					const isClassroomSelected =
						lecture.selectedClassrooms.size === 0 ||
						lecture.selectedClassrooms.has(classroom.codigo)

					if (!isClassroomSelected) continue
					if (!classroom.horario) continue

					for (const schedule of classroom.horario) {
						const daySchedules = byDay.get(schedule.dia)
						if (daySchedules) {
							daySchedules.push({
								schedule,
								classroom,
								lecture,
								isActive: true,
							})
						}
					}
				}
			}
		}

		return byDay
	})
</script>

<div class="flex flex-col h-full">
	<!-- Header row with day names -->
	<div class="flex border-b border-zinc-300 dark:border-zinc-600 shrink-0">
		<!-- Time column header -->
		<div class="w-10 shrink-0"></div>

		<!-- Day headers -->
		{#each visibleDays as day}
			<div class="flex-1 text-center text-xs font-bold uppercase py-1 border-l border-zinc-200 dark:border-zinc-700">
				{DAY_NAMES[day]}
			</div>
		{/each}
	</div>

	<!-- Schedule grid -->
	<div class="flex flex-1 min-h-0">
		<!-- Time column - uses flexbox to distribute hours evenly -->
		<div class="w-10 shrink-0 flex flex-col justify-between pt-[5px] pb-[5px]">
			{#each hours as hour}
				<div class="text-[10px] text-zinc-500 dark:text-zinc-400 text-right pr-2 leading-none">
					{hour}
				</div>
			{/each}
		</div>

		<!-- Day columns -->
		{#each visibleDays as day}
			<div class="flex-1 relative border-l border-zinc-200 dark:border-zinc-700">
				<!-- Inner container with padding for grid alignment -->
				<div class="absolute inset-x-0 top-[5px] bottom-[5px]">
					<!-- Hour grid lines - evenly distributed (skip first and last) -->
					{#each hours as _, i}
						{#if i > 0 && i < totalHours}
							{@const topPercent = (i / totalHours) * 100}
							<div
								class="absolute left-0 right-0 border-t border-zinc-200 dark:border-zinc-700"
								style="top: {topPercent}%;"
							></div>
						{/if}
					{/each}

					<!-- Schedule boxes for this day -->
					{#each schedulesByDay.get(day) ?? [] as item (
						`${item.lecture.data.codigo}-${item.classroom.codigo}-${item.schedule.inicio}`
					)}
						<ScheduleBox
							schedule={item.schedule}
							lectureCode={item.lecture.data.codigo}
							lectureName={item.lecture.data.nome}
							classroomCode={item.classroom.codigo}
							color={item.lecture.color}
							isActive={item.isActive}
							{startHour}
							{endHour}
						/>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
