<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLButtonAttributes } from 'svelte/elements'

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
		size?: 'sm' | 'md' | 'lg'
		children: Snippet
	}

	let { variant = 'primary', size = 'md', children, class: className, ...rest }: Props = $props()

	const baseStyles = 'font-medium border-2 border-black dark:border-white cursor-pointer'

	const variants = {
		primary: 'bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200',
		secondary: 'bg-white text-black dark:bg-black dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900',
		ghost: 'bg-transparent border-transparent hover:border-black dark:hover:border-white',
		danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700 hover:border-red-700',
	}

	const sizes = {
		sm: 'px-2 py-1 text-sm',
		md: 'px-4 py-2',
		lg: 'px-6 py-3 text-lg',
	}
</script>

<button class="{baseStyles} {variants[variant]} {sizes[size]} {className ?? ''}" {...rest}>
	{@render children()}
</button>
