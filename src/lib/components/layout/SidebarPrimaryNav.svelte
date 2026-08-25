<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';
	import SidebarCreateResource from './SidebarCreateResource.svelte';

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

<SidebarCreateResource {isOpen} {canCreate} {currentPath} {onCloseMobile} />
