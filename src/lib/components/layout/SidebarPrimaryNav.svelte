<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	let {
		isOpen,
		currentPath,
		canCreate,
		onCloseMobile
	}: {
		isOpen: boolean;
		currentPath: string;
		canCreate: boolean;
		onCloseMobile: () => void;
	} = $props();
</script>

<a
	href="/"
	onclick={onCloseMobile}
	data-sveltekit-preload-data="hover"
	class={cn(
		'group flex items-center rounded-xl font-bold transition-all duration-300',
		isOpen ? 'gap-3 px-4 py-3 text-sm' : 'justify-center p-2.5',
		currentPath === '/'
			? 'bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.3)]'
			: 'text-muted-foreground hover:bg-muted hover:text-foreground'
	)}
	aria-label={!isOpen ? 'Dashboard' : undefined}
>
	<Icon
		name="dashboard"
		size={isOpen ? 18 : 22}
		class={cn('shrink-0 transition-transform group-hover:scale-110', currentPath === '/' && 'animate-pulse')}
	/>
	<span
		class={cn(
			'overflow-hidden whitespace-nowrap transition-all duration-300',
			isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
		)}
	>
		Dashboard
	</span>
</a>

<div class="mx-2 my-2 h-px bg-sidebar-border/50"></div>

{#if !canCreate}
	<Tooltip.Provider delayDuration={200}>
		<Tooltip.Root>
			<Tooltip.Trigger class="w-full">
				{#snippet child({ props })}
					<span {...props}>
						<button
							type="button"
							aria-disabled="true"
							class={cn(
								'group flex w-full cursor-not-allowed items-center rounded-xl text-muted-foreground opacity-60 transition-all duration-300',
								isOpen ? 'gap-3 px-4 py-3 text-sm font-bold' : 'justify-center p-2.5'
							)}
						>
							<div
								class={cn(
									'flex shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors',
									isOpen ? 'size-5' : 'size-7'
								)}
							>
								<Icon name="plus" size={isOpen ? 14 : 20} />
							</div>
							<span
								class={cn(
									'overflow-hidden whitespace-nowrap transition-all duration-300',
									isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
								)}
							>
								Create Resource
							</span>
						</button>
					</span>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="right">
				<p class="text-xs text-white">You need additional permissions to create resources.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	<a
		href="/create"
		onclick={onCloseMobile}
		data-sveltekit-preload-data="hover"
		class={cn(
			'group flex items-center rounded-xl font-bold transition-all duration-300',
			isOpen ? 'gap-3 px-4 py-3 text-sm' : 'justify-center p-2.5',
			currentPath.startsWith('/create')
				? 'bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.4)]'
				: 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
		)}
		aria-label={!isOpen ? 'Create Resource' : undefined}
	>
		<div
			class={cn(
				'flex shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground',
				isOpen ? 'size-5' : 'size-7'
			)}
		>
			<Icon name="plus" size={isOpen ? 14 : 20} />
		</div>
		<span
			class={cn(
				'overflow-hidden whitespace-nowrap transition-all duration-300',
				isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
			)}
		>
			Create Resource
		</span>
	</a>
{/if}
