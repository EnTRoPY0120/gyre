<script lang="ts">
	import { LogOut, User as UserIcon, Shield, KeyRound, BadgeCheck } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { fade, scale } from 'svelte/transition';

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

	async function handleLogout() {
		try {
			const res = await fetch('/api/auth/logout', { method: 'POST' });
			if (res.ok) {
				window.location.href = '/login?loggedOut=true';
			}
		} catch (err) {
			console.error('Logout failed:', err);
		}
	}

	// Close menu on click outside
	function handleOutsideClick(e: MouseEvent) {
		if (isOpen) {
			const target = e.target as HTMLElement;
			if (!target.closest('.user-menu-container')) {
				isOpen = false;
			}
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<div class="user-menu-container relative">
	<button
		type="button"
		class={cn(
			'flex h-10 items-center gap-2 rounded-full border border-border/50 bg-secondary/30 px-3 transition-all hover:bg-secondary/50 active:scale-95',
			isOpen && 'bg-secondary/60 ring-2 ring-primary/20'
		)}
		onclick={() => (isOpen = !isOpen)}
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

			<div class="my-1 h-px bg-border/50"></div>

			<div class="space-y-0.5">
				<button
					class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
				>
					<Shield class="size-4" />
					Role: <span class="font-medium text-foreground capitalize">{user?.role}</span>
				</button>

				{#if isLocalUser}
					<a
						href="/change-password"
						class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
					>
						<KeyRound class="size-4" />
						Change Password
					</a>
				{/if}

				<div class="my-1 h-px bg-border/50"></div>

				<button
					onclick={handleLogout}
					class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-all hover:bg-red-500/10 active:scale-[0.98]"
				>
					<LogOut class="size-4" />
					Log out
				</button>
			</div>
		</div>
	{/if}
</div>
