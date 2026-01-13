<script lang="ts">
	import Header from '~/lib/components/layout/Header.svelte'
	import { LectureSearch, LectureCard, CourseImportDialog } from '~/lib/components/lecture'
	import { TimeTable, CombinationTrack } from '~/lib/components/schedule'
	import { ExportDialog } from '~/lib/components/export'
	import { appState } from '~/lib/stores/state.svelte'
	import { initializeDatabase, dbState, fetchLecture } from '~/lib/services/database'
	import { hasShareData, loadFromShareURL } from '~/lib/services/export/share'
	import { X, Loader2 } from 'lucide-svelte'
	import { onMount } from 'svelte'

	let sidebarOpen = $state(true)
	let dbProgress = $state(0)
	let dbError = $state<string | null>(null)
	let courseImportOpen = $state(false)
	let exportDialogOpen = $state(false)
	let isLoaded = $state(false)

	// Initialize database on mount
	onMount(() => {
		initializeDatabase((progress: number) => {
			dbProgress = progress
		})
			.then(async () => {
				// After DB is ready, check for share URL first
				if (hasShareData()) {
					await loadFromShareURL()
				} else {
					// Otherwise load from localStorage
					await appState.load(fetchLecture)
				}
				isLoaded = true
			})
			.catch((err: Error) => {
				dbError = err.message
			})
	})

	// Auto-save state when it changes (debounced)
	let saveTimeout: ReturnType<typeof setTimeout> | null = null
	
	$effect(() => {
		// Track state changes by accessing the serialized state
		const _ = appState.serialize()
		
		// Don't save until initial load is complete
		if (!isLoaded) return
		
		// Debounce saves
		if (saveTimeout) clearTimeout(saveTimeout)
		saveTimeout = setTimeout(() => {
			appState.save()
		}, 500)
	})

	// Plan rename state
	let editingPlanIndex = $state<number | null>(null)
	let editingPlanName = $state('')

	function startRename(index: number) {
		editingPlanIndex = index
		editingPlanName = appState.plans[index].name
	}

	function finishRename() {
		if (editingPlanIndex !== null && editingPlanName.trim()) {
			appState.renamePlan(editingPlanIndex, editingPlanName.trim())
		}
		editingPlanIndex = null
		editingPlanName = ''
	}

	function cancelRename() {
		editingPlanIndex = null
		editingPlanName = ''
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			finishRename()
		} else if (e.key === 'Escape') {
			cancelRename()
		}
	}

	function focusOnMount(node: HTMLElement) {
		node.focus()
	}
</script>

<div class="min-h-screen bg-white dark:bg-black text-black dark:text-white">
	<Header
		onMenuClick={() => (sidebarOpen = !sidebarOpen)}
		onCourseImport={() => (courseImportOpen = true)}
		onShare={() => (exportDialogOpen = true)}
	/>

	<!-- Course Import Dialog -->
	<CourseImportDialog bind:open={courseImportOpen} />

	<!-- Export/Share Dialog -->
	<ExportDialog bind:open={exportDialogOpen} />

	<div class="flex">
		<!-- Sidebar -->
		<aside
			class="w-80 border-r-2 border-black dark:border-white h-[calc(100vh-57px)] overflow-y-auto flex flex-col
				{sidebarOpen ? 'block' : 'hidden'} lg:block"
		>
			<!-- Search -->
			<div class="p-3 border-b-2 border-black dark:border-white">
				{#if dbProgress < 1}
					<div class="flex items-center gap-2 text-sm text-zinc-500">
						<Loader2 class="w-4 h-4 animate-spin" />
						<span>Carregando banco de dados... {Math.round(dbProgress * 100)}%</span>
					</div>
					<div class="mt-2 h-1 bg-zinc-200 dark:bg-zinc-700">
						<div
							class="h-full bg-black dark:bg-white transition-all"
							style="width: {dbProgress * 100}%"
						></div>
					</div>
				{:else if dbError}
					<div class="text-sm text-red-600 dark:text-red-400">
						Erro ao carregar: {dbError}
					</div>
				{:else}
					<LectureSearch />
				{/if}
			</div>

			<!-- Lecture list -->
			<div class="flex-1 overflow-y-auto">
				{#if appState.activePlan && appState.activePlan.lectures.length > 0}
					<div class="space-y-0">
						{#each appState.activePlan.lectures as lecture (lecture.data.codigo)}
							<LectureCard {lecture} />
						{/each}
					</div>
				{:else}
					<div class="p-4 text-sm text-zinc-500 text-center">
						<p class="mb-2">Nenhuma disciplina adicionada</p>
						<p>Busque disciplinas acima para adicionar ao plano</p>
					</div>
				{/if}
			</div>

			<!-- Credits summary (sticky bottom) -->
			{#if appState.activePlan && appState.activePlan.lectures.length > 0}
				<div class="p-3 border-t-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-900">
					<div class="text-xs font-bold uppercase tracking-wide mb-1">Créditos</div>
					<div class="flex gap-4 text-sm">
						<span>
							<strong>Aula:</strong> {appState.totalCredits.aula}
						</span>
						<span>
							<strong>Trabalho:</strong> {appState.totalCredits.trabalho}
						</span>
						<span class="text-zinc-500">
							Total: {appState.totalCredits.aula + appState.totalCredits.trabalho}
						</span>
					</div>
				</div>
			{/if}
		</aside>

		<!-- Main content -->
		<main class="flex-1 h-[calc(100vh-57px)] overflow-hidden flex flex-col">
			<!-- Plan tabs -->
			<div class="border-b-2 border-black dark:border-white shrink-0">
				<div class="flex items-center gap-0">
					{#each appState.plans as plan, i}
						{@const isActive = appState.activePlanIndex === i}
						{@const isEditing = editingPlanIndex === i}
						<div
							class="relative flex items-center border-r-2 border-black dark:border-white
								{isActive ? 'bg-black text-white dark:bg-white dark:text-black' : ''}"
						>
							{#if isEditing}
								<input
									type="text"
									bind:value={editingPlanName}
									onblur={finishRename}
									onkeydown={handleRenameKeydown}
									class="px-3 py-1.5 text-sm font-medium bg-transparent border-none outline-none w-24
										{isActive ? 'text-white dark:text-black' : 'text-black dark:text-white'}"
									use:focusOnMount
								/>
							{:else}
								<button
									type="button"
									onclick={() => appState.setActivePlan(i)}
									ondblclick={() => startRename(i)}
									class="px-3 py-1.5 text-sm font-medium
										{!isActive ? 'hover:bg-zinc-100 dark:hover:bg-zinc-900' : ''}"
									title="Clique duplo para renomear"
								>
									{plan.name}
								</button>
							{/if}
							{#if appState.plans.length > 1}
								<button
									type="button"
									onclick={() => appState.removePlan(i)}
									class="pr-2 pl-0 py-1.5 opacity-60 hover:opacity-100"
									title="Remover plano"
								>
									<X class="w-3.5 h-3.5" />
								</button>
							{/if}
						</div>
					{/each}
					<button
						type="button"
						onclick={() => appState.addPlan()}
						class="px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
						title="Adicionar plano"
					>
						+
					</button>
				</div>
			</div>

			<!-- Schedule grid area -->
			<div class="flex-1 p-4 min-h-0 flex flex-col gap-0">
				<div class="border-2 border-black dark:border-white flex-1 min-h-0">
					{#if appState.activePlan}
						<TimeTable
							lectures={appState.activePlan.lectures}
							activeCombination={appState.activeCombination}
						/>
					{/if}
				</div>

				<!-- Combination track -->
				{#if appState.activePlan && appState.selectedLectures.length > 0}
					<CombinationTrack
						combinations={appState.combinations}
						activeCombinationIndex={appState.activePlan.activeCombinationIndex}
						onSelect={(index) => appState.setActiveCombination(index)}
						hitLimit={appState.combinationsHitLimit}
					/>
				{/if}
			</div>
		</main>
	</div>
</div>
