<script lang="ts">
	import { theme, type Theme } from '$lib/stores/theme.svelte';

	const themeOptions: { value: Theme; label: string; icon: string }[] = [
		{ value: 'light', label: 'Light', icon: 'sun' },
		{ value: 'dark', label: 'Dark', icon: 'moon' },
		{ value: 'system', label: 'System', icon: 'computer' }
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
		class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
		onclick={() => (isOpen = !isOpen)}
		aria-label="Toggle theme"
		title="Toggle theme"
	>
		{#if theme.theme === 'light'}
			<!-- Sun icon -->
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
				/>
			</svg>
		{:else if theme.theme === 'dark'}
			<!-- Moon icon -->
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				/>
			</svg>
		{:else}
			<!-- Computer/System icon -->
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		{/if}
	</button>

	{#if isOpen}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-36 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
		>
			{#each themeOptions as option}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {theme.theme ===
					option.value
						? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
						: 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'}"
					onclick={() => selectTheme(option.value)}
				>
					{#if option.icon === 'sun'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					{:else if option.icon === 'moon'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
							/>
						</svg>
					{:else}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
							/>
						</svg>
					{/if}
					{option.label}
					{#if theme.theme === option.value}
						<svg class="ml-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
