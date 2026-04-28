<script lang="ts">
	import { theme, type Theme } from '$lib/stores/theme.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { Sun, Moon, Monitor, Check } from 'lucide-svelte';

	const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	let isOpen = $state(false);
	let selectedIndex = $state(-1);

	function getInitialIndex() {
		return themeOptions.findIndex((opt) => opt.value === theme.theme);
	}

	function selectTheme(newTheme: Theme) {
		theme.setTheme(newTheme);
		isOpen = false;
		void fetch('/api/v1/user/preferences', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRF-Token': getCsrfToken()
			},
			body: JSON.stringify({ theme: newTheme })
		}).catch(() => {});
	}

	function focusMenuButton(index: number) {
		const buttons = document.querySelectorAll('.theme-toggle-container [role="menuitem"]');
		const button = buttons[index] as HTMLButtonElement | undefined;
		if (button) {
			button.focus();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.theme-toggle-container')) {
			isOpen = false;
		}
	}

	function handleButtonKeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!isOpen) {
				isOpen = true;
				selectedIndex = getInitialIndex();
				// Focus the menu item after the menu opens
				$effect.pre(() => {
					if (isOpen && selectedIndex >= 0) {
						focusMenuButton(selectedIndex);
					}
				});
			} else {
				isOpen = false;
			}
		} else if (e.key === 'ArrowDown' && isOpen) {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % themeOptions.length;
			focusMenuButton(selectedIndex);
		} else if (e.key === 'ArrowUp' && isOpen) {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + themeOptions.length) % themeOptions.length;
			focusMenuButton(selectedIndex);
		} else if (e.key === 'Escape') {
			isOpen = false;
		}
	}

	function handleMenuItemKeydown(e: KeyboardEvent, option: Theme, index: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			selectTheme(option);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % themeOptions.length;
			focusMenuButton(selectedIndex);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + themeOptions.length) % themeOptions.length;
			focusMenuButton(selectedIndex);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			isOpen = false;
		} else if (e.key === 'Tab') {
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
		onkeydown={handleButtonKeydown}
		aria-label="Toggle theme"
		aria-haspopup="menu"
		aria-expanded={isOpen}
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
			role="menu"
		>
			{#each themeOptions as option, index (option.value)}
				<button
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {theme.theme ===
					option.value
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} {selectedIndex ===
					index
						? 'bg-accent text-accent-foreground'
						: ''}"
					onclick={() => selectTheme(option.value)}
					onkeydown={(e) => handleMenuItemKeydown(e, option.value, index)}
					role="menuitem"
					tabindex={selectedIndex === index ? 0 : -1}
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
