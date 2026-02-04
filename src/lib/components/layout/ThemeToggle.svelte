<script lang="ts">
	import { theme, type Theme } from '$lib/stores/theme.svelte';
	import { Sun, Moon, Monitor, Check } from 'lucide-svelte';

	const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	let isOpen = $state(false);

	function selectTheme(newTheme: Theme) {
		theme.setTheme(newTheme);
		isOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.theme-toggle-container')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="theme-toggle-container relative">
	<button
		type="button"
		class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
		onclick={() => (isOpen = !isOpen)}
		aria-label="Toggle theme"
		title="Toggle theme"
	>
		{#if theme.theme === 'light'}
			<Sun class="size-5" />
		{:else if theme.theme === 'dark'}
			<Moon class="size-5" />
		{:else}
			<Monitor class="size-5" />
		{/if}
	</button>

	{#if isOpen}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-36 origin-top-right rounded-lg border border-border bg-popover py-1 shadow-lg"
		>
			{#each themeOptions as option (option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {theme.theme ===
					option.value
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					onclick={() => selectTheme(option.value)}
				>
					<option.icon class="size-4" />
					{option.label}
					{#if theme.theme === option.value}
						<Check class="ml-auto size-4" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
