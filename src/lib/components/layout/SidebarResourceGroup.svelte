<script lang="ts">
	import { page } from '$app/stores';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import { FluxResourceType, type ResourceGroup } from '$lib/types/flux';
	import Icon from '$lib/components/ui/Icon.svelte';

	let {
		group,
		isOpen,
		expanded,
		onToggle,
		onCloseMobile
	}: {
		group: ResourceGroup;
		isOpen: boolean;
		expanded: boolean;
		onToggle: () => void;
		onCloseMobile: () => void;
	} = $props();

	const currentPath = $derived($page.url.pathname);
	const groupId = $derived(`panel-${group.name.toLowerCase().replace(/\s+/g, '-')}`);

	const resourceIcons: Partial<Record<FluxResourceType, string>> = {
		[FluxResourceType.GitRepository]: 'git-branch',
		[FluxResourceType.HelmRepository]: 'library',
		[FluxResourceType.HelmChart]: 'package',
		[FluxResourceType.Bucket]: 'bucket',
		[FluxResourceType.OCIRepository]: 'cloud',
		[FluxResourceType.Kustomization]: 'file-cog',
		[FluxResourceType.HelmRelease]: 'ship',
		[FluxResourceType.Alert]: 'shield-alert',
		[FluxResourceType.Provider]: 'radio',
		[FluxResourceType.Receiver]: 'activity'
	};

	function isActive(type: string): boolean {
		return currentPath.includes(`/resources/${type}`);
	}
</script>

<div class="w-full space-y-1">
	<button
		type="button"
		onclick={onToggle}
		aria-expanded={isOpen ? expanded : undefined}
		aria-controls={isOpen ? groupId : undefined}
		class={cn(
			'group flex items-center transition-all duration-300',
			isOpen
				? 'w-full justify-between px-3 py-2 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase hover:text-primary'
				: 'mx-auto justify-center rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-primary active:scale-95'
		)}
		aria-label={!isOpen ? group.name : undefined}
	>
		<div class="flex items-center gap-2.5 whitespace-nowrap">
			<Icon
				name={group.icon || 'layers'}
				size={isOpen ? 14 : 20}
				class={cn('opacity-50 transition-all group-hover:text-primary group-hover:opacity-100', isOpen && 'shrink-0')}
			/>
			<span
				class={cn(
					'transition-all duration-300 overflow-hidden whitespace-nowrap',
					isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
				)}
			>
				{group.name}
			</span>
		</div>

		{#if isOpen}
			<Icon
				name="chevron-right"
				size={12}
				class={cn(
					'text-muted-foreground/50 transition-transform duration-300 group-hover:text-primary',
					expanded ? 'rotate-90' : 'rotate-0'
				)}
			/>
		{/if}
	</button>

	{#if isOpen && expanded}
		<div id={groupId} class="relative ml-2 space-y-1 border-l border-sidebar-border/30 pl-3">
			<div
				class="absolute top-0 bottom-0 left-[-1px] w-[1px] bg-gradient-to-b from-primary/0 via-primary/0 to-primary/0 transition-all duration-300 group-hover:via-primary/50"
			></div>

			{#each group.resources as resource (resource.type)}
				{@const iconName = resourceIcons[resource.type] || 'file-cog'}
				{@const active = isActive(resource.type)}
				<a
					href="/resources/{resource.type}"
					onclick={onCloseMobile}
					data-sveltekit-preload-data="hover"
					class={cn(
						'group/item relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
						active
							? 'border border-primary/20 bg-primary/10 text-primary shadow-sm'
							: 'text-muted-foreground/80 hover:bg-primary/5 hover:text-primary'
					)}
				>
					{#if active}
						<div class="absolute inset-0 animate-pulse bg-primary/5"></div>
					{/if}
					<Icon
						name={iconName}
						size={16}
						class={cn('shrink-0 transition-transform duration-300 group-hover/item:scale-110', active && 'text-primary')}
					/>
					<span class="relative z-10 whitespace-nowrap transition-opacity duration-300">
						{resource.displayName}
					</span>
					{#if active}
						<div class="absolute right-2 size-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
