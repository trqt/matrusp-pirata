<script lang="ts">
	import type { Snippet } from 'svelte'
	import { X } from 'lucide-svelte'

	interface Props {
		open?: boolean
		title?: string
		children: Snippet
		onclose?: () => void
	}

	let { open = $bindable(false), title, children, onclose }: Props = $props()

	function handleClose() {
		open = false
		onclose?.()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose()
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose()
		}
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 z-40"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<!-- Dialog -->
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'dialog-title' : undefined}
			class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
				w-full max-w-lg max-h-[85vh] p-0 m-0 flex flex-col
				bg-white dark:bg-black border-2 border-black dark:border-white"
		>
			{#if title}
				<header class="flex items-center justify-between px-4 py-3 border-b-2 border-black dark:border-white shrink-0">
					<h2 id="dialog-title" class="text-lg font-bold uppercase">{title}</h2>
					<button
						type="button"
						onclick={handleClose}
						class="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900"
						aria-label="Fechar"
					>
						<X class="w-5 h-5" />
					</button>
				</header>
			{/if}
			<div class="p-4 overflow-y-auto">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
