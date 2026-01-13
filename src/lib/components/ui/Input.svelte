<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements'

	interface Props extends HTMLInputAttributes {
		label?: string
		error?: string
	}

	let { label, error, id, class: className, ...rest }: Props = $props()

	const generatedId = `input-${Math.random().toString(36).slice(2, 7)}`
	const inputId = $derived(id ?? generatedId)
</script>

<div class="flex flex-col gap-1">
	{#if label}
		<label for={inputId} class="text-sm font-medium">
			{label}
		</label>
	{/if}
	<input
		id={inputId}
		class="px-3 py-2 border-2 border-black dark:border-white bg-transparent 
			focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white
			placeholder:text-zinc-500 {error ? 'border-red-600' : ''} {className ?? ''}"
		{...rest}
	/>
	{#if error}
		<span class="text-sm text-red-600">{error}</span>
	{/if}
</div>
