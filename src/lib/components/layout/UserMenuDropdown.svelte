<script lang="ts">
	import { LogOut, Shield, KeyRound, BadgeCheck } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';
import type { UserMenuUser } from './user-menu-types';

	let {
		user,
		isLocalUser,
		selectedIndex,
		logoutError,
		onLogout
	}: {
		user: UserMenuUser | null;
		isLocalUser: boolean;
		selectedIndex: number;
		logoutError: string | null;
		onLogout: () => void;
	} = $props();
</script>

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
			onclick={onLogout}
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
