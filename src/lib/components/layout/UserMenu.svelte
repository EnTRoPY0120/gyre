<script lang="ts">
	import { User as UserIcon } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { logger } from '$lib/utils/logger.js';
	import { getCsrfToken } from '$lib/utils/csrf';
	import UserMenuDropdown from './UserMenuDropdown.svelte';
	import type { UserMenuUser } from './user-menu-types';

	interface Props {
		user: UserMenuUser | null;
	}

	let { user }: Props = $props();
	let isOpen = $state(false);
	let isLocalUser = $derived(user?.isLocal !== false);
	let logoutError = $state<string | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);
	let menuContainer = $state<HTMLDivElement | null>(null);
	let previousActiveElement: HTMLElement | null = null;
	let selectedIndex = $state(0);

	// Compute the list of focusable menu items dynamically
	const menuItemCount = $derived(isLocalUser ? 3 : 2); // Role, [ChangePassword], Logout

	async function handleLogout() {
		logoutError = null;
		try {
			const res = await fetch('/api/v1/auth/logout', {
				method: 'POST',
				headers: { 'X-CSRF-Token': getCsrfToken() }
			});
			if (res.ok) {
				window.location.href = '/login?loggedOut=true';
			} else {
				logger.error(`Logout failed with status ${res.status}`);
				logoutError = 'Logout failed. Please try again.';
			}
		} catch (err) {
			logger.error(err, 'Logout failed:');
			logoutError = 'Logout failed. Please try again.';
		}
	}

	function openMenu() {
		if (typeof document !== 'undefined') {
			previousActiveElement = document.activeElement as HTMLElement;
		}
		selectedIndex = 0;
		isOpen = true;
		// Focus first menu item on next tick
		setTimeout(() => {
			const firstItem = menuContainer?.querySelector<HTMLElement>('[data-menu-item="0"]');
			firstItem?.focus();
		}, 0);
	}

	function closeMenu(restoreFocus = true) {
		isOpen = false;
		logoutError = null;
		if (restoreFocus) {
			previousActiveElement?.focus();
		}
		previousActiveElement = null;
	}

	function handleTriggerClick() {
		if (isOpen) {
			// Focus is already on the trigger — no need to restore
			closeMenu(false);
		} else {
			openMenu();
		}
	}

	function handleMenuKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % menuItemCount;
				focusItem(selectedIndex);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = selectedIndex <= 0 ? menuItemCount - 1 : selectedIndex - 1;
				focusItem(selectedIndex);
				break;
			case 'Escape':
				e.preventDefault();
				// Per ARIA pattern: Escape returns focus to the trigger
				closeMenu(true);
				break;
			case 'Tab':
				// Tab moves focus naturally; don't steal it back to the trigger
				closeMenu(false);
				break;
		}
	}

	function focusItem(index: number) {
		const item = menuContainer?.querySelector<HTMLElement>(`[data-menu-item="${index}"]`);
		item?.focus();
	}

	// Close menu on click outside
	function handleOutsideClick(e: MouseEvent) {
		if (isOpen) {
			const target = e.target as HTMLElement;
			if (!target.closest('.user-menu-container')) {
				// Don't steal focus from whatever the user just clicked
				closeMenu(false);
			}
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<div role="none" bind:this={menuContainer} class="user-menu-container relative" onkeydown={handleMenuKeydown}>
	<button
		bind:this={triggerButton}
		type="button"
		class={cn(
			'flex h-10 items-center gap-2 rounded-full border border-border/50 bg-secondary/30 px-3 transition-all hover:bg-secondary/50 active:scale-95',
			isOpen && 'bg-secondary/60 ring-2 ring-primary/20'
		)}
		onclick={handleTriggerClick}
		aria-label="Open user menu"
		aria-expanded={isOpen}
		aria-haspopup="menu"
	>
		<div class="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
			<UserIcon class="size-4" />
		</div>
		<div class="hidden text-left sm:block">
			<p class="text-xs leading-none font-bold">{user?.username || 'User'}</p>
			<p class="mt-0.5 text-[10px] text-muted-foreground capitalize">{user?.role || 'Guest'}</p>
		</div>
	</button>

	{#if isOpen}
		<UserMenuDropdown
			{user}
			{isLocalUser}
			{selectedIndex}
			{logoutError}
			onLogout={handleLogout}
		/>
	{/if}
</div>
