<script lang="ts">
	import { Check } from 'lucide-svelte'

	interface Props {
		checked?: boolean
		label?: string
		id?: string
		disabled?: boolean
		onchange?: () => void
	}

	let { checked = false, label, id, disabled = false, onchange }: Props = $props()

	const generatedId = `checkbox-${Math.random().toString(36).slice(2, 7)}`
	const checkboxId = $derived(id ?? generatedId)

	function handleChange() {
		onchange?.()
	}
</script>

<label
	for={checkboxId}
	class="flex items-center gap-2 cursor-pointer select-none {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
>
	<button
		type="button"
		role="checkbox"
		aria-checked={checked}
		id={checkboxId}
		{disabled}
		onclick={handleChange}
		class="w-5 h-5 border-2 border-black dark:border-white flex items-center justify-center
			{checked ? 'bg-black dark:bg-white' : 'bg-transparent'}
			focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white"
	>
		{#if checked}
			<Check class="w-3 h-3 text-white dark:text-black" strokeWidth={3} />
		{/if}
	</button>
	{#if label}
		<span class="text-sm">{label}</span>
	{/if}
</label>
