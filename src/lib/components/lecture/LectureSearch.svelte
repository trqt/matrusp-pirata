<script lang="ts">
	import type { LectureData } from '~/lib/models/types'
	import { appState } from '~/lib/stores/state.svelte'
	import { searchLectures } from '~/lib/services/database'
	import { Search, Loader2, X } from 'lucide-svelte'
	import SearchFilters from './SearchFilters.svelte'

	// Search state
	let query = $state('')
	let results = $state<LectureData[]>([])
	let isLoading = $state(false)
	let selectedIndex = $state(-1)
	let showResults = $state(false)

	// Filter state
	let campus = $state('')
	let unidade = $state('')
	let departamento = $state('')
	let periodos = $state<string[]>([])

	// Debounce timer
	let debounceTimer: ReturnType<typeof setTimeout> | undefined

	// Perform search using trigram index
	async function performSearch(q: string) {
		if (q.length < 2) {
			results = []
			return
		}

		isLoading = true

		try {
			const searchResults = await searchLectures(q, {
				limit: 20,
				campus: campus || undefined,
				unidade: unidade || undefined,
				departamento: departamento || undefined,
				periodos: periodos.length > 0 ? periodos : undefined,
			})
			results = searchResults
		} catch (error) {
			console.error('Search error:', error)
			results = []
		} finally {
			isLoading = false
		}
	}

	// Handle input change with debounce
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement
		query = target.value
		selectedIndex = -1

		if (debounceTimer) clearTimeout(debounceTimer)

		if (query.length >= 2) {
			debounceTimer = setTimeout(() => performSearch(query), 150)
		} else {
			results = []
		}
	}

	// Handle keyboard navigation
	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				if (selectedIndex < results.length - 1) {
					selectedIndex++
				}
				break
			case 'ArrowUp':
				e.preventDefault()
				if (selectedIndex > 0) {
					selectedIndex--
				}
				break
			case 'Enter':
				e.preventDefault()
				if (selectedIndex >= 0 && results[selectedIndex]) {
					selectLecture(results[selectedIndex])
				}
				break
			case 'Escape':
				e.preventDefault()
				showResults = false
				break
		}
	}

	// Select a lecture and add to plan
	function selectLecture(lecture: LectureData) {
		const added = appState.addLecture(lecture)
		if (added) {
			query = ''
			results = []
			showResults = false
		}
	}

	// Clear search
	function clearSearch() {
		query = ''
		results = []
		selectedIndex = -1
	}

	// Handle focus
	function handleFocus() {
		showResults = true
	}

	// Handle blur with delay (to allow click on results)
	function handleBlur() {
		setTimeout(() => {
			showResults = false
		}, 200)
	}

	// Re-search when filters change
	function handleFiltersChange() {
		if (query.length >= 2) {
			performSearch(query)
		}
	}
</script>

<div class="space-y-2">
	<!-- Search filters -->
	<SearchFilters
		bind:campus
		bind:unidade
		bind:departamento
		bind:periodos
		onchange={handleFiltersChange}
	/>

	<!-- Search input -->
	<div class="relative">
		<div class="relative">
			<Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
			<input
				type="text"
				placeholder="Buscar (código ou nome)..."
				value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onfocus={handleFocus}
				onblur={handleBlur}
				class="w-full pl-7 pr-7 py-1.5 border-2 border-black dark:border-white
					bg-white dark:bg-black text-xs
					focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
			/>
			{#if query}
				<button
					type="button"
					onclick={clearSearch}
					class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				>
					<X class="w-3.5 h-3.5" />
				</button>
			{/if}
		</div>

		<!-- Results dropdown -->
		{#if showResults && (results.length > 0 || isLoading || query.length >= 2)}
			<div
				class="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto
					bg-white dark:bg-black border-2 border-black dark:border-white"
			>
				{#if isLoading}
					<div class="flex items-center justify-center gap-2 p-4 text-sm text-zinc-500">
						<Loader2 class="w-4 h-4 animate-spin" />
						<span>Buscando...</span>
					</div>
				{:else if results.length === 0 && query.length >= 2}
					<div class="p-4 text-sm text-zinc-500 text-center">
						Nenhum resultado encontrado
					</div>
				{:else}
					{#each results as lecture, i (lecture.codigo)}
						{@const isSelected = i === selectedIndex}
						{@const isInPlan = appState.activePlan?.lectures.some(l => l.data.codigo === lecture.codigo)}
						<button
							type="button"
							onclick={() => selectLecture(lecture)}
							onmouseenter={() => (selectedIndex = i)}
							disabled={isInPlan}
							class="w-full text-left p-3 border-b border-zinc-200 dark:border-zinc-700
								last:border-b-0 transition-colors
								{isSelected ? 'bg-zinc-100 dark:bg-zinc-800' : ''}
								{isInPlan ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}"
						>
							<div class="flex items-start gap-2">
								<div class="flex-1 min-w-0">
									<div class="font-mono text-sm font-bold">
										{lecture.codigo}
										{#if isInPlan}
											<span class="font-normal text-xs text-zinc-500">(já adicionada)</span>
										{/if}
									</div>
									<div class="text-sm truncate">{lecture.nome}</div>
									<div class="text-xs text-zinc-500 truncate mt-0.5">
										{lecture.unidade}
									</div>
								</div>
								<div class="text-xs text-zinc-500 shrink-0">
									{lecture.creditos_aula + lecture.creditos_trabalho}c
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
