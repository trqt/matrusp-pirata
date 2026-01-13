<script lang="ts">
	import type { PlanLecture, ClassroomData } from '~/lib/models/types'
	import { appState } from '~/lib/stores/state.svelte'
	import { getColorClasses, getColorDotClasses } from '~/lib/utils/color'
	import { formatSchedule, sortSchedules, getClassroomTeachers, getTotalVacancies, getShortCode } from '~/lib/utils/schedule'
	import { ChevronDown, X, Check } from 'lucide-svelte'
	import Checkbox from '~/lib/components/ui/Checkbox.svelte'

	interface Props {
		lecture: PlanLecture
	}

	let { lecture }: Props = $props()

	let isOpen = $state(false)

	// Derived values
	let selectedCount = $derived(
		lecture.selectedClassrooms.size === 0
			? lecture.data.turmas.length // All selected by default
			: lecture.selectedClassrooms.size
	)

	let allSelected = $derived(
		lecture.selectedClassrooms.size === 0 || 
		lecture.selectedClassrooms.size === lecture.data.turmas.length
	)

	let totalCredits = $derived(lecture.data.creditos_aula + lecture.data.creditos_trabalho)

	// Check if a classroom is selected
	function isClassroomSelected(classroom: ClassroomData): boolean {
		// If no classrooms explicitly selected, all are selected by default
		if (lecture.selectedClassrooms.size === 0) return true
		return lecture.selectedClassrooms.has(classroom.codigo)
	}

	function handleLectureToggle() {
		appState.toggleLecture(lecture.data.codigo)
	}

	function handleRemove() {
		appState.removeLecture(lecture.data.codigo)
	}

	function handleClassroomToggle(classroom: ClassroomData) {
		appState.toggleClassroom(lecture.data.codigo, classroom.codigo)
	}

	function handleHeaderClick() {
		isOpen = !isOpen
	}
</script>

<div
	class="border-2 border-black dark:border-white"
	class:opacity-50={!lecture.selected}
>
	<!-- Header -->
	<div
		class="w-full flex items-center gap-2 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
	>
		<!-- Color indicator -->
		<span class={getColorDotClasses(lecture.color)}></span>

		<!-- Lecture checkbox -->
		<Checkbox
			checked={lecture.selected}
			onchange={handleLectureToggle}
			label=""
		/>

		<!-- Lecture info (clickable to expand) -->
		<button
			type="button"
			onclick={handleHeaderClick}
			class="flex-1 min-w-0 text-left"
		>
			<div class="font-mono text-sm font-bold">{lecture.data.codigo}</div>
			<div class="text-sm truncate">{lecture.data.nome}</div>
		</button>

		<!-- Credits badge -->
		<span class="text-xs font-mono px-1 border border-black dark:border-white">
			{totalCredits}c
		</span>

		<!-- Expand/collapse button -->
		<button
			type="button"
			onclick={handleHeaderClick}
			class="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
			title={isOpen ? 'Recolher' : 'Expandir'}
		>
			<ChevronDown
				class="w-4 h-4 shrink-0 transition-transform {isOpen ? 'rotate-180' : ''}"
			/>
		</button>

		<!-- Delete button -->
		<button
			type="button"
			onclick={handleRemove}
			class="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
			title="Remover disciplina"
		>
			<X class="w-4 h-4" />
		</button>
	</div>

	<!-- Expanded content -->
	{#if isOpen}
		<div class="border-t-2 border-black dark:border-white">
			<!-- Lecture details -->
			<div class="p-3 text-xs space-y-1 bg-zinc-50 dark:bg-zinc-900 border-b border-black dark:border-white">
				<div><strong>Campus:</strong> {lecture.data.campus}</div>
				<div><strong>Unidade:</strong> {lecture.data.unidade}</div>
				<div><strong>Departamento:</strong> {lecture.data.departamento}</div>
				<div>
					<strong>Créditos:</strong> {lecture.data.creditos_aula} aula + {lecture.data.creditos_trabalho} trabalho
				</div>
			</div>

			<!-- Classrooms header -->
			<div class="px-3 py-2 text-xs font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-800 border-b border-black dark:border-white">
				Turmas ({selectedCount}/{lecture.data.turmas.length})
			</div>

			<!-- Classroom list -->
			<div class="divide-y divide-zinc-200 dark:divide-zinc-700">
				{#each lecture.data.turmas as classroom (classroom.codigo)}
					{@const teachers = getClassroomTeachers(classroom)}
					{@const vacancies = getTotalVacancies(classroom)}
					{@const schedules = sortSchedules(classroom.horario)}
					{@const selected = isClassroomSelected(classroom)}

					<div
						class="p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
						class:bg-zinc-100={selected}
						class:dark:bg-zinc-800={selected}
					>
						<div class="flex items-start gap-2">
							<!-- Classroom checkbox -->
							<span class="mt-0.5">
								<Checkbox
									checked={selected}
									onchange={() => handleClassroomToggle(classroom)}
									label=""
								/>
							</span>

							<div class="flex-1 min-w-0">
								<!-- Classroom header -->
								<div class="flex items-center gap-2 mb-1">
									<span class="font-mono font-bold">{getShortCode(classroom.codigo)}</span>
									<span class="text-xs px-1 bg-zinc-200 dark:bg-zinc-700">{classroom.tipo}</span>
									<span class="text-xs text-zinc-500">
										{vacancies.enrolled + vacancies.inscribed}/{vacancies.total} vagas
									</span>
								</div>

								<!-- Teachers -->
								{#if teachers.length > 0}
									<div class="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
										{teachers.join(', ')}
									</div>
								{/if}

								<!-- Schedules -->
								<div class="flex flex-wrap gap-1">
									{#each schedules as schedule}
										<span class="text-xs font-mono px-1 py-0.5 border border-zinc-300 dark:border-zinc-600">
											{formatSchedule(schedule)}
										</span>
									{/each}
								</div>

								<!-- Period -->
								<div class="text-xs text-zinc-500 mt-1">
									{classroom.inicio} - {classroom.fim}
								</div>

								<!-- Observations -->
								{#if classroom.observacoes}
									<div class="text-xs text-zinc-500 mt-1 italic">
										{classroom.observacoes}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
