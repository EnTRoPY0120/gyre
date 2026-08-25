<script lang="ts">
	import { page } from '$app/stores';
	import { sidebarOpen } from '$lib/stores/sidebar';
	import { cn } from '$lib/utils';
	import type { ResourceGroup } from '$lib/types/flux';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SidebarResourceList from './SidebarResourceList.svelte';

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
		<SidebarResourceList {group} {groupId} {currentPath} {onCloseMobile} />
	{/if}
</div>
