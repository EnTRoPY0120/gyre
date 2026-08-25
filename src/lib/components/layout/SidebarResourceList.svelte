<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';
	import { FluxResourceType, type ResourceGroup } from '$lib/types/flux';

	let {
		group,
		groupId,
		currentPath,
		onCloseMobile
	}: {
		group: ResourceGroup;
		groupId: string;
		currentPath: string;
		onCloseMobile: () => void;
	} = $props();

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
				class={cn(
					'shrink-0 transition-transform duration-300 group-hover/item:scale-110',
					active && 'text-primary'
				)}
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
