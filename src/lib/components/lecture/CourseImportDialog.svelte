<script lang="ts">
	import Dialog from '~/lib/components/ui/Dialog.svelte'
	import Button from '~/lib/components/ui/Button.svelte'
	import { fetchCampi, fetchCoursesByUnit, fetchCourse, fetchLecture } from '~/lib/services/database'
	import { appState } from '~/lib/stores/state.svelte'
	import type { CourseData, CourseLectureInfo, LectureData } from '~/lib/models/types'
	import { Loader2 } from 'lucide-svelte'

	interface Props {
		open: boolean
	}

	let { open = $bindable() }: Props = $props()

	// Dropdown data
	let campiList = $state<string[]>([])
	let unitsList = $state<string[]>([])
	let coursesList = $state<CourseData[]>([])
	let periodsList = $state<string[]>([])

	// Selected values
	let selectedCampus = $state('')
	let selectedUnit = $state('')
	let selectedCourseCode = $state('')
	let selectedPeriod = $state('')
	let includeOptativas = $state(false)

	// Current course data
	let selectedCourse = $state<CourseData | null>(null)

	// Lecture preview
	let obrigatorias = $state<{ info: CourseLectureInfo; lecture: LectureData | null }[]>([])
	let optativas = $state<{ info: CourseLectureInfo; lecture: LectureData | null }[]>([])

	// Loading states
	let isLoadingCampi = $state(false)
	let isLoadingUnits = $state(false)
	let isLoadingCourses = $state(false)
	let isLoadingPeriods = $state(false)
	let isLoadingLectures = $state(false)
	let isImporting = $state(false)

	// Load campi on open
	$effect(() => {
		if (open && campiList.length === 0) {
			loadCampi()
		}
	})

	async function loadCampi() {
		isLoadingCampi = true
		try {
			const campi = await fetchCampi()
			campiList = Object.keys(campi).sort()
		} catch {
			campiList = []
		} finally {
			isLoadingCampi = false
		}
	}

	async function handleCampusChange(e: Event) {
		selectedCampus = (e.target as HTMLSelectElement).value
		selectedUnit = ''
		selectedCourseCode = ''
		selectedPeriod = ''
		selectedCourse = null
		coursesList = []
		periodsList = []
		obrigatorias = []
		optativas = []

		if (!selectedCampus) {
			unitsList = []
			return
		}

		isLoadingUnits = true
		try {
			const campi = await fetchCampi()
			unitsList = campi[selectedCampus] || []
		} catch {
			unitsList = []
		} finally {
			isLoadingUnits = false
		}
	}

	async function handleUnitChange(e: Event) {
		selectedUnit = (e.target as HTMLSelectElement).value
		selectedCourseCode = ''
		selectedPeriod = ''
		selectedCourse = null
		periodsList = []
		obrigatorias = []
		optativas = []

		if (!selectedUnit) {
			coursesList = []
			return
		}

		isLoadingCourses = true
		try {
			coursesList = await fetchCoursesByUnit(selectedUnit)
		} catch {
			coursesList = []
		} finally {
			isLoadingCourses = false
		}
	}

	async function handleCourseChange(e: Event) {
		selectedCourseCode = (e.target as HTMLSelectElement).value
		selectedPeriod = ''
		obrigatorias = []
		optativas = []

		if (!selectedCourseCode) {
			selectedCourse = null
			periodsList = []
			return
		}

		isLoadingPeriods = true
		try {
			selectedCourse = (await fetchCourse(selectedCourseCode)) ?? null
			if (selectedCourse) {
				periodsList = Object.keys(selectedCourse.periodos).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
			} else {
				periodsList = []
			}
		} catch {
			selectedCourse = null
			periodsList = []
		} finally {
			isLoadingPeriods = false
		}
	}

	async function handlePeriodChange(e: Event) {
		selectedPeriod = (e.target as HTMLSelectElement).value
		obrigatorias = []
		optativas = []

		if (!selectedPeriod || !selectedCourse) {
			return
		}

		isLoadingLectures = true
		try {
			const lectureInfos = selectedCourse.periodos[selectedPeriod] || []

			// Separate by type
			const obrigInfos = lectureInfos.filter((l) => l.tipo === 'obrigatoria')
			const optInfos = lectureInfos.filter((l) => l.tipo !== 'obrigatoria')

			// Fetch lecture data for each
			obrigatorias = await Promise.all(
				obrigInfos.map(async (info) => ({
					info,
					lecture: await fetchLecture(info.codigo) || null,
				}))
			)

			optativas = await Promise.all(
				optInfos.map(async (info) => ({
					info,
					lecture: await fetchLecture(info.codigo) || null,
				}))
			)
		} catch {
			obrigatorias = []
			optativas = []
		} finally {
			isLoadingLectures = false
		}
	}

	async function handleImport() {
		if (!selectedCourse || !selectedPeriod) return

		isImporting = true
		try {
			const lectureInfos = selectedCourse.periodos[selectedPeriod] || []
			const coursePeriodo = selectedCourse.periodo // "diurno", "noturno", etc.

			// Get the display name for the course
			const courseOption = coursesList.find((c) => c.codigo === selectedCourseCode)
			const courseName = courseOption?.nome || selectedCourseCode

			// Create new plan
			const planName = `${courseName} - ${selectedPeriod}º período`

			// If current plan is empty, rename it instead of creating new
			if (appState.activePlan && appState.activePlan.lectures.length === 0) {
				appState.renamePlan(appState.activePlanIndex, planName)
			} else {
				appState.addPlan(planName)
			}

			// Collect lectures to import
			const lecturesToImport: { info: CourseLectureInfo; lecture: LectureData }[] = []

			for (const lectureInfo of lectureInfos) {
				// Skip optativas if not included
				if (lectureInfo.tipo !== 'obrigatoria' && !includeOptativas) {
					continue
				}

				// Use already-fetched lecture data if available
				const existingEntry = [...obrigatorias, ...optativas].find(
					(e) => e.info.codigo === lectureInfo.codigo
				)

				let lecture: LectureData | null = existingEntry?.lecture ?? null

				// If not found in cache, fetch it
				if (!lecture) {
					lecture = (await fetchLecture(lectureInfo.codigo)) ?? null
				}

				if (lecture && lecture.turmas.length > 0) {
					lecturesToImport.push({ info: lectureInfo, lecture })
				}
			}

			// Add all lectures to the plan
			for (const { lecture } of lecturesToImport) {
				// Filter classrooms by course period
				let filteredClassrooms: string[] = []

				if (['diurno', 'noturno', 'matutino', 'vespertino'].includes(coursePeriodo)) {
					filteredClassrooms = lecture.turmas
						.filter((turma) => {
							// If no schedules, include the turma
							if (!turma.horario || turma.horario.length === 0) return true

							return turma.horario.every((horario) => {
								const hourInit = parseInt(horario.inicio.substring(0, 2), 10)

								switch (coursePeriodo) {
									case 'diurno':
										return hourInit < 18
									case 'noturno':
										return hourInit >= 18
									case 'matutino':
										return hourInit < 12
									case 'vespertino':
										return hourInit >= 12 && hourInit < 18
									default:
										return true
								}
							})
						})
						.map((turma) => turma.codigo)
				}

				// Add lecture to plan
				const added = appState.addLecture(lecture)

				// If we filtered classrooms, set them as selected
				if (added && filteredClassrooms.length > 0 && filteredClassrooms.length < lecture.turmas.length) {
					const planLecture = appState.activePlan?.lectures.find(
						(l) => l.data.codigo === lecture.codigo
					)
					if (planLecture) {
						// Add all filtered classrooms to selection
						for (const codigo of filteredClassrooms) {
							planLecture.selectedClassrooms.add(codigo)
						}
					}
				}
			}

			// Close dialog
			open = false

			// Reset state
			resetState()
		} catch (error) {
			console.error('Failed to import course:', error)
		} finally {
			isImporting = false
		}
	}

	function resetState() {
		selectedCampus = ''
		selectedUnit = ''
		selectedCourseCode = ''
		selectedPeriod = ''
		selectedCourse = null
		includeOptativas = false
		unitsList = []
		coursesList = []
		periodsList = []
		obrigatorias = []
		optativas = []
	}

	function handleClose() {
		resetState()
	}

	// Count lectures that will be imported
	let importCount = $derived(
		obrigatorias.length + (includeOptativas ? optativas.length : 0)
	)

	// Check if can import
	let canImport = $derived(
		selectedCourse !== null &&
			selectedPeriod !== '' &&
			(obrigatorias.length > 0 || optativas.length > 0)
	)
</script>

<Dialog bind:open title="Importar Grade Curricular" onclose={handleClose}>
	<div class="space-y-4">
		<!-- Campus -->
		<div>
			<label for="import-campus" class="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Campus</label>
			<select
				id="import-campus"
				value={selectedCampus}
				onchange={handleCampusChange}
				disabled={isLoadingCampi}
				class="w-full px-3 py-2 border-2 border-black dark:border-white
					bg-white dark:bg-black text-sm disabled:opacity-50"
			>
				<option value="">Selecione um campus</option>
				{#each campiList as campus}
					<option value={campus}>{campus}</option>
				{/each}
			</select>
		</div>

		<!-- Unit -->
		<div>
			<label for="import-unit" class="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Unidade</label>
			<select
				id="import-unit"
				value={selectedUnit}
				onchange={handleUnitChange}
				disabled={!selectedCampus || isLoadingUnits}
				class="w-full px-3 py-2 border-2 border-black dark:border-white
					bg-white dark:bg-black text-sm disabled:opacity-50"
			>
				<option value="">Selecione uma unidade</option>
				{#each unitsList as unit}
					<option value={unit}>{unit}</option>
				{/each}
			</select>
		</div>

		<!-- Course -->
		<div>
			<label for="import-course" class="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Curso</label>
			<select
				id="import-course"
				value={selectedCourseCode}
				onchange={handleCourseChange}
				disabled={!selectedUnit || isLoadingCourses || coursesList.length === 0}
				class="w-full px-3 py-2 border-2 border-black dark:border-white
					bg-white dark:bg-black text-sm disabled:opacity-50"
			>
				{#if coursesList.length === 0 && selectedUnit}
					<option value="">Nenhum curso disponível</option>
				{:else}
					<option value="">Selecione um curso</option>
					{#each coursesList as course}
						<option value={course.codigo}>{course.nome} ({course.periodo})</option>
					{/each}
				{/if}
			</select>
		</div>

		<!-- Period -->
		<div>
			<label for="import-period" class="block text-xs uppercase tracking-wide text-zinc-500 mb-1">Período (Semestre)</label>
			<select
				id="import-period"
				value={selectedPeriod}
				onchange={handlePeriodChange}
				disabled={!selectedCourseCode || isLoadingPeriods || periodsList.length === 0}
				class="w-full px-3 py-2 border-2 border-black dark:border-white
					bg-white dark:bg-black text-sm disabled:opacity-50"
			>
				<option value="">Selecione um período</option>
				{#each periodsList as period}
					<option value={period}>{period}º período</option>
				{/each}
			</select>
		</div>

		<!-- Include optativas checkbox -->
		{#if optativas.length > 0}
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={includeOptativas}
					class="w-4 h-4 border-2 border-black dark:border-white"
				/>
				<span class="text-sm">Incluir optativas ({optativas.length})</span>
			</label>
		{/if}

		<!-- Lecture list -->
		{#if isLoadingLectures}
			<div class="flex items-center justify-center py-4 gap-2 text-zinc-500">
				<Loader2 class="w-4 h-4 animate-spin" />
				<span class="text-sm">Carregando disciplinas...</span>
			</div>
		{:else if selectedPeriod}
			<div class="max-h-60 overflow-y-auto border-2 border-zinc-200 dark:border-zinc-700">
				{#if obrigatorias.length > 0}
					<div class="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700">
						Obrigatórias ({obrigatorias.length})
					</div>
					{#each obrigatorias as { info, lecture }}
						<div class="px-3 py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0">
							{#if lecture}
								<span class="font-mono text-xs">{lecture.codigo}</span>
								<span class="mx-1">-</span>
								<span>{lecture.nome}</span>
								{#if lecture.turmas.length === 0}
									<span class="text-zinc-400 text-xs ml-1">(sem oferecimento)</span>
								{/if}
							{:else}
								<span class="font-mono text-xs">{info.codigo}</span>
								<span class="text-zinc-400 text-xs ml-1">(não encontrada)</span>
							{/if}
						</div>
					{/each}
				{/if}

				{#if optativas.length > 0}
					<div class="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-xs font-bold uppercase tracking-wide border-b border-zinc-200 dark:border-zinc-700">
						Optativas ({optativas.length})
					</div>
					{#each optativas as { info, lecture }}
						<div
							class="px-3 py-2 text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0
								{includeOptativas ? '' : 'opacity-40'}"
						>
							{#if lecture}
								<span class="font-mono text-xs">{lecture.codigo}</span>
								<span class="mx-1">-</span>
								<span>{lecture.nome}</span>
								{#if info.tipo === 'optativa_livre'}
									<span class="text-zinc-400 text-xs ml-1">(livre)</span>
								{:else if info.tipo === 'optativa_eletiva'}
									<span class="text-zinc-400 text-xs ml-1">(eletiva)</span>
								{/if}
								{#if lecture.turmas.length === 0}
									<span class="text-zinc-400 text-xs ml-1">(sem oferecimento)</span>
								{/if}
							{:else}
								<span class="font-mono text-xs">{info.codigo}</span>
								<span class="text-zinc-400 text-xs ml-1">(não encontrada)</span>
							{/if}
						</div>
					{/each}
				{/if}

				{#if obrigatorias.length === 0 && optativas.length === 0}
					<div class="px-3 py-4 text-center text-zinc-400 text-sm">
						Nenhuma disciplina neste período
					</div>
				{/if}
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex items-center justify-between pt-2">
			<span class="text-xs text-zinc-500">
				{#if canImport}
					{importCount} disciplina{importCount === 1 ? '' : 's'} ser{importCount === 1 ? 'á' : 'ão'} importada{importCount === 1 ? '' : 's'}
				{/if}
			</span>
			<div class="flex gap-2">
				<Button variant="secondary" onclick={() => (open = false)}>
					Cancelar
				</Button>
				<Button
					onclick={handleImport}
					disabled={!canImport || isImporting}
				>
					{#if isImporting}
						<Loader2 class="w-4 h-4 animate-spin mr-2" />
					{/if}
					Importar
				</Button>
			</div>
		</div>
	</div>
</Dialog>
