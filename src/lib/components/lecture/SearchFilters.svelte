<script lang="ts">
	import { db, fetchCampi, fetchUnits } from '~/lib/services/database'
	import { ChevronDown, X } from 'lucide-svelte'
	import { onMount } from 'svelte'

	interface Props {
		campus: string
		unidade: string
		departamento: string
		periodos: string[]
		onchange: () => void
	}

	let { campus = $bindable(), unidade = $bindable(), departamento = $bindable(), periodos = $bindable(), onchange }: Props = $props()

	// Data for dropdowns
	let campiList = $state<string[]>([])
	let unitsList = $state<string[]>([])
	let departmentsList = $state<string[]>([])

	// Expanded state
	let isExpanded = $state(false)

	// Summary text
	let summaryText = $derived(buildSummaryText())

	// Has active filters
	let hasFilters = $derived(!!campus || !!unidade || !!departamento || periodos.length > 0)

	onMount(async () => {
		await loadCampi()
	})

	async function loadCampi() {
		try {
			const campi = await fetchCampi()
			campiList = Object.keys(campi).sort()
		} catch {
			campiList = []
		}
	}

	async function loadUnits() {
		try {
			if (campus) {
				const campi = await fetchCampi()
				unitsList = campi[campus] || []
			} else {
				const units = await fetchUnits()
				unitsList = Object.keys(units).sort()
			}
		} catch {
			unitsList = []
		}
	}

	async function loadDepartments() {
		try {
			if (unidade) {
				const departments = await db.units.get(unidade)
				departmentsList = departments || []
			} else {
				departmentsList = []
			}
		} catch {
			departmentsList = []
		}
	}

	async function handleCampusChange(e: Event) {
		campus = (e.target as HTMLSelectElement).value
		unidade = ''
		departamento = ''
		await loadUnits()
		departmentsList = []
		onchange()
	}

	async function handleUnitChange(e: Event) {
		unidade = (e.target as HTMLSelectElement).value
		departamento = ''
		await loadDepartments()
		onchange()
	}

	function handleDepartmentChange(e: Event) {
		departamento = (e.target as HTMLSelectElement).value
		onchange()
	}

	function handlePeriodoToggle(periodo: string) {
		if (periodos.includes(periodo)) {
			periodos = periodos.filter((p) => p !== periodo)
		} else {
			periodos = [...periodos, periodo]
		}
		onchange()
	}

	function clearFilters() {
		campus = ''
		unidade = ''
		departamento = ''
		periodos = []
		unitsList = []
		departmentsList = []
		onchange()
	}

	function buildSummaryText(): string {
		let text = 'Buscando'

		if (!campus && !unidade) {
			text += ' em todos os campi'
		} else if (unidade) {
			const unitPrep = getPreposition(unidade)
			if (departamento && departamento !== unidade) {
				// Get acronym for unit
				const unitAcronym = getAcronym(unidade)
				const dept = departamento.replace(new RegExp(`(de |da |do )?(${unidade}|${unitAcronym})`, 'i'), '').trim()

				if (dept === 'Disciplinas' || dept === '') {
					text += ` ${unitPrep} ${unidade}`
				} else if (dept.includes('Interdepartamenta')) {
					text += ' disciplinas interdepartamentais'
				} else if (dept.startsWith('Departamento')) {
					text += ` no ${dept} (${unitAcronym})`
				} else {
					text += ` no departamento de ${dept} (${unitAcronym})`
				}
			} else {
				text += ` ${unitPrep} ${unidade}`
			}
		} else if (campus) {
			if (campus === 'Outro') {
				text += ' em outros campi'
			} else {
				text += ` no campus de ${campus}`
			}
		}

		if (periodos.length > 0 && periodos.length < 3) {
			const periodLabels = periodos.map((p) => {
				if (p === 'matutino') return 'matutino'
				if (p === 'vespertino') return 'vespertino'
				return 'noturno'
			})
			text += ` em período ${periodLabels.join(' ou ')}`
		}

		return text
	}

	function getPreposition(unit: string): string {
		if (/^(Escola|Faculdade|Licenciatura|Pró-Reitoria)/.test(unit)) return 'na'
		if (/^(Instituto|Centro|Museu|Hospital)/.test(unit)) return 'no'
		return 'em'
	}

	function getAcronym(unit: string): string {
		if (unit === 'Escola Politécnica') return 'Poli'
		if (unit === 'Faculdade de Direito') return 'Sanfran'
		const matches = unit.match(/\b[A-Z]/g)
		return matches ? matches.join('') : unit.slice(0, 4)
	}

	// Load units when component mounts or campus changes
	$effect(() => {
		if (campiList.length > 0) {
			loadUnits()
		}
	})
</script>

<div class="text-xs">
	<!-- Summary / Toggle button -->
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		class="w-full flex items-center justify-between gap-2 py-1.5 px-2 text-left
			bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
	>
		<span class="truncate {hasFilters ? 'font-medium' : 'text-zinc-500'}">{summaryText}</span>
		<ChevronDown class="w-3.5 h-3.5 shrink-0 transition-transform {isExpanded ? 'rotate-180' : ''}" />
	</button>

	<!-- Expanded filters -->
	{#if isExpanded}
		<div class="p-2 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
			<!-- Campus -->
			<div>
				<label for="filter-campus" class="block text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">Campus</label>
				<select
					id="filter-campus"
					value={campus}
					onchange={handleCampusChange}
					class="w-full px-2 py-1 border border-zinc-300 dark:border-zinc-600
						bg-white dark:bg-black text-xs"
				>
					<option value="">Todos os campi</option>
					{#each campiList as c}
						<option value={c}>{c}</option>
					{/each}
				</select>
			</div>

			<!-- Unit -->
			<div>
				<label for="filter-unit" class="block text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">Unidade</label>
				<select
					id="filter-unit"
					value={unidade}
					onchange={handleUnitChange}
					class="w-full px-2 py-1 border border-zinc-300 dark:border-zinc-600
						bg-white dark:bg-black text-xs"
				>
					<option value="">Todas as unidades</option>
					{#each unitsList as u}
						<option value={u}>{u}</option>
					{/each}
				</select>
			</div>

			<!-- Department -->
			<div>
				<label for="filter-dept" class="block text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">Departamento</label>
				<select
					id="filter-dept"
					value={departamento}
					onchange={handleDepartmentChange}
					disabled={!unidade || departmentsList.length === 0}
					class="w-full px-2 py-1 border border-zinc-300 dark:border-zinc-600
						bg-white dark:bg-black text-xs disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<option value="">Todos os departamentos</option>
					{#each departmentsList as d}
						<option value={d}>{d}</option>
					{/each}
				</select>
			</div>

			<!-- Time periods -->
			<fieldset>
				<legend class="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Período</legend>
				<div class="flex gap-2">
					{#each ['matutino', 'vespertino', 'noturno'] as periodo}
						<label class="flex items-center gap-1 cursor-pointer">
							<input
								type="checkbox"
								checked={periodos.includes(periodo)}
								onchange={() => handlePeriodoToggle(periodo)}
								class="w-3 h-3"
							/>
							<span class="capitalize">{periodo}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<!-- Clear button -->
			{#if hasFilters}
				<button
					type="button"
					onclick={clearFilters}
					class="flex items-center gap-1 text-zinc-500 hover:text-black dark:hover:text-white"
				>
					<X class="w-3 h-3" />
					Limpar filtros
				</button>
			{/if}
		</div>
	{/if}
</div>
