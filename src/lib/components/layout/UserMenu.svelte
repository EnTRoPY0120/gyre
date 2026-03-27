<script lang="ts">
	import { LogOut, User as UserIcon, Shield, KeyRound, BadgeCheck } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { logger } from '$lib/utils/logger.js';
	import { fade, scale } from 'svelte/transition';
	import { getCsrfToken } from '$lib/utils/csrf';

	interface Props {
		user: {
			username: string;
			role: string;
			email?: string | null;
			isLocal?: boolean;
		} | null;
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
		<div
			in:scale={{ duration: 150, start: 0.95, opacity: 0 }}
			out:fade={{ duration: 100 }}
			class="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl"
		>
			<!-- Profile summary — outside the menu subtree intentionally -->
			<div class="px-3 py-2">
				<div class="flex items-center justify-between">
					<p class="text-xs font-medium text-muted-foreground">Signed in as</p>
					{#if !isLocalUser}
						<span
							class="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400"
						>
							<BadgeCheck class="size-3" />
							SSO
						</span>
					{/if}
				</div>
				<p class="truncate text-sm font-bold">{user?.username}</p>
				{#if user?.email}
					<p class="truncate text-[10px] text-muted-foreground">{user.email}</p>
				{/if}
			</div>

			<div aria-hidden="true" class="my-1 h-px bg-border/50"></div>

			<!-- Menu actions — role="menu" scoped to only the interactive items -->
			<div role="menu" aria-label="User menu" class="space-y-0.5">
				<div
					role="menuitem"
					aria-disabled="true"
					tabindex="-1"
					data-menu-item="0"
					class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground"
				>
					<Shield class="size-4" />
					Role: <span class="font-medium text-foreground capitalize">{user?.role}</span>
				</div>

				{#if isLocalUser}
					<a
						href="/change-password"
						role="menuitem"
						tabindex={selectedIndex === 1 ? 0 : -1}
						data-menu-item="1"
						class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
					>
						<KeyRound class="size-4" />
						Change Password
					</a>
				{/if}

				<div role="separator" class="my-1 h-px bg-border/50"></div>

				<button
					onclick={handleLogout}
					role="menuitem"
					tabindex={selectedIndex === (isLocalUser ? 2 : 1) ? 0 : -1}
					data-menu-item={isLocalUser ? '2' : '1'}
					class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-all hover:bg-red-500/10 active:scale-[0.98]"
				>
					<LogOut class="size-4" />
					Log out
				</button>
				{#if logoutError}
					<p class="px-3 py-1 text-xs text-red-500">{logoutError}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
