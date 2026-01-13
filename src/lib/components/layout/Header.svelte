<script lang="ts">
	import { Sun, Moon, Menu, Share2 } from 'lucide-svelte'
	import { uiState } from '~/lib/stores/ui.svelte'

	interface Props {
		onMenuClick?: () => void
		onCourseImport?: () => void
		onShare?: () => void
	}

	let { onMenuClick, onCourseImport, onShare }: Props = $props()
</script>

<header class="border-b-2 border-black dark:border-white bg-white dark:bg-black">
	<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
		<div class="flex items-center gap-4">
			{#if onMenuClick}
				<button
					type="button"
					onclick={onMenuClick}
					class="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:hidden"
					aria-label="Toggle menu"
				>
					<Menu class="w-5 h-5" />
				</button>
			{/if}
			<h1 class="text-xl font-bold uppercase tracking-tight">MatrUSP</h1>
		</div>

		<nav class="flex items-center gap-2">
			{#if onCourseImport}
				<button
					type="button"
					onclick={onCourseImport}
					class="px-3 py-1.5 text-sm font-medium border-2 border-black dark:border-white 
						hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
						transition-colors"
				>
					Importar Grade
				</button>
			{/if}
			{#if onShare}
				<button
					type="button"
					onclick={onShare}
					class="px-3 py-1.5 text-sm font-medium border-2 border-black dark:border-white 
						hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
						transition-colors flex items-center gap-1.5"
				>
					<Share2 class="w-4 h-4" />
					Compartilhar
				</button>
			{/if}
			<button
				type="button"
				onclick={() => uiState.toggleTheme()}
				class="p-2 border-2 border-black dark:border-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
				aria-label="Alternar tema"
			>
				{#if uiState.isDark}
					<Sun class="w-5 h-5" />
				{:else}
					<Moon class="w-5 h-5" />
				{/if}
			</button>
		</nav>
	</div>
</header>
