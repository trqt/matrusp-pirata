<script lang="ts">
	import { Dialog } from '~/lib/components/ui'
	import { appState } from '~/lib/stores/state.svelte'
	import { downloadICS } from '~/lib/services/export/ics'
	import {
		generateShareURL,
		copyToClipboard,
		getWhatsAppShareURL,
		getEmailShareURL,
	} from '~/lib/services/export/share'
	import { Calendar, Link, Copy, Check, Mail } from 'lucide-svelte'

	interface Props {
		open?: boolean
	}

	let { open = $bindable(false) }: Props = $props()

	let shareURL = $state('')
	let copied = $state(false)
	let icsDownloaded = $state(false)

	// Generate share URL when dialog opens
	$effect(() => {
		if (open) {
			shareURL = generateShareURL()
			copied = false
			icsDownloaded = false
		}
	})

	async function handleCopy() {
		const success = await copyToClipboard(shareURL)
		if (success) {
			copied = true
			setTimeout(() => {
				copied = false
			}, 2000)
		}
	}

	function handleWhatsApp() {
		window.open(getWhatsAppShareURL(shareURL), '_blank')
	}

	function handleEmail() {
		window.location.href = getEmailShareURL(shareURL)
	}

	function handleICS() {
		if (!appState.activePlan) return

		const success = downloadICS(appState.activePlan.lectures, appState.activeCombination)
		if (success) {
			icsDownloaded = true
			setTimeout(() => {
				icsDownloaded = false
			}, 2000)
		}
	}

	const hasValidCombination = $derived(
		appState.activeCombination !== null && appState.selectedLectures.length > 0
	)
</script>

<Dialog bind:open title="Compartilhar">
	<div class="space-y-6">
		<!-- Share Link Section -->
		<section>
			<h3 class="text-sm font-bold uppercase tracking-wide mb-3">Link</h3>

			<div class="flex gap-2">
				<input
					type="text"
					readonly
					value={shareURL}
					class="flex-1 px-3 py-2 text-sm border-2 border-black dark:border-white
						bg-zinc-50 dark:bg-zinc-900 font-mono truncate"
				/>
				<button
					type="button"
					onclick={handleCopy}
					class="px-3 py-2 border-2 border-black dark:border-white
						hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
						transition-colors flex items-center gap-2"
					title="Copiar link"
				>
					{#if copied}
						<Check class="w-4 h-4" />
					{:else}
						<Copy class="w-4 h-4" />
					{/if}
				</button>
			</div>

			<div class="flex gap-2 mt-3">
				<button
					type="button"
					onclick={handleWhatsApp}
					class="flex-1 px-3 py-2 text-sm font-medium border-2 border-black dark:border-white
						hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
						transition-colors flex items-center justify-center gap-2"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
						/>
					</svg>
					WhatsApp
				</button>

				<button
					type="button"
					onclick={handleEmail}
					class="flex-1 px-3 py-2 text-sm font-medium border-2 border-black dark:border-white
						hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
						transition-colors flex items-center justify-center gap-2"
				>
					<Mail class="w-4 h-4" />
					E-mail
				</button>
			</div>
		</section>

		<!-- Calendar Export Section -->
		<section>
			<h3 class="text-sm font-bold uppercase tracking-wide mb-3">Calendário</h3>

			<button
				type="button"
				onclick={handleICS}
				disabled={!hasValidCombination}
				class="w-full px-4 py-3 text-sm font-medium border-2 border-black dark:border-white
					hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
					disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent
					disabled:hover:text-inherit dark:disabled:hover:bg-transparent
					transition-colors flex items-center justify-center gap-2"
			>
				{#if icsDownloaded}
					<Check class="w-5 h-5" />
					Baixado!
				{:else}
					<Calendar class="w-5 h-5" />
					Baixar Calendário (.ics)
				{/if}
			</button>

			{#if !hasValidCombination}
				<p class="text-xs text-zinc-500 mt-2 text-center">
					Selecione disciplinas e uma combinação para exportar o calendário
				</p>
			{:else}
				<p class="text-xs text-zinc-500 mt-2 text-center">
					Importe no Google Calendar, Apple Calendar, Outlook, etc.
				</p>
			{/if}
		</section>
	</div>
</Dialog>
