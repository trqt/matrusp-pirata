<script lang="ts">
	import type { Combination } from '~/lib/services/combination'
	import CombinationBoard from './CombinationBoard.svelte'
	import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-svelte'

	interface Props {
		combinations: Combination[]
		activeCombinationIndex: number
		onSelect: (index: number) => void
		hitLimit?: boolean
	}

	let { combinations, activeCombinationIndex, onSelect, hitLimit = false }: Props = $props()

	let scrollContainer: HTMLDivElement | undefined = $state()

	// Pagination
	const PAGE_SIZE = 50
	let currentPage = $state(0)

	let totalPages = $derived(Math.ceil(combinations.length / PAGE_SIZE))
	let startIndex = $derived(currentPage * PAGE_SIZE)
	let endIndex = $derived(Math.min(startIndex + PAGE_SIZE, combinations.length))
	let visibleCombinations = $derived(combinations.slice(startIndex, endIndex))

	// Keep the active combination in view when it changes
	$effect(() => {
		const pageForActive = Math.floor(activeCombinationIndex / PAGE_SIZE)
		if (pageForActive !== currentPage) {
			currentPage = pageForActive
		}
	})

	function prevPage() {
		if (currentPage > 0) {
			currentPage--
		}
	}

	function nextPage() {
		if (currentPage < totalPages - 1) {
			currentPage++
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			if (activeCombinationIndex > 0) {
				onSelect(activeCombinationIndex - 1)
			}
		} else if (e.key === 'ArrowRight') {
			if (activeCombinationIndex < combinations.length - 1) {
				onSelect(activeCombinationIndex + 1)
			}
		}
	}
</script>

{#if combinations.length > 0}
	<div
		class="flex items-center gap-2 p-2 border-t-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-900"
		onkeydown={handleKeyDown}
		tabindex="0"
		role="listbox"
		aria-label="Combinações de horários"
	>
		<!-- Info label -->
		<div class="shrink-0 text-xs font-bold uppercase tracking-wide min-w-[80px]">
			<div class="flex items-center gap-1">
				{combinations.length} comb.
				{#if hitLimit}
					<span title="Limite de combinações atingido. Desselecione algumas turmas para ver mais opções.">
						<AlertTriangle class="w-3.5 h-3.5 text-amber-500" />
					</span>
				{/if}
			</div>
			<div class="text-zinc-500 font-normal">
				{activeCombinationIndex + 1}/{combinations.length}
			</div>
		</div>

		<!-- Pagination prev -->
		{#if totalPages > 1}
			<button
				type="button"
				onclick={prevPage}
				disabled={currentPage === 0}
				class="shrink-0 p-1 border-2 border-black dark:border-white disabled:opacity-30 disabled:cursor-not-allowed
					hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
				title="Página anterior"
			>
				<ChevronLeft class="w-4 h-4" />
			</button>
		{/if}

		<!-- Scrollable track -->
		<div
			bind:this={scrollContainer}
			class="flex-1 overflow-x-auto flex gap-2 py-1 scrollbar-thin"
		>
			{#each visibleCombinations as combination, i (startIndex + i)}
				{@const globalIndex = startIndex + i}
				<CombinationBoard
					{combination}
					isActive={globalIndex === activeCombinationIndex}
					onclick={() => onSelect(globalIndex)}
				/>
			{/each}
		</div>

		<!-- Pagination next -->
		{#if totalPages > 1}
			<button
				type="button"
				onclick={nextPage}
				disabled={currentPage >= totalPages - 1}
				class="shrink-0 p-1 border-2 border-black dark:border-white disabled:opacity-30 disabled:cursor-not-allowed
					hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
				title="Próxima página"
			>
				<ChevronRight class="w-4 h-4" />
			</button>
		{/if}
	</div>
{:else if combinations.length === 0}
	<div class="p-3 border-t-2 border-black dark:border-white bg-zinc-50 dark:bg-zinc-900 text-center text-sm text-zinc-500">
		Nenhuma combinação disponível
	</div>
{/if}

<style>
	.scrollbar-thin::-webkit-scrollbar {
		height: 6px;
	}

	.scrollbar-thin::-webkit-scrollbar-track {
		background: transparent;
	}

	.scrollbar-thin::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 3px;
	}

	:global(.dark) .scrollbar-thin::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
	}
</style>
