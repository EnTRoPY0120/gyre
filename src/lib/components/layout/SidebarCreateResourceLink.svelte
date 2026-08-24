<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	let {
		isOpen,
		currentPath,
		onCloseMobile
	}: {
		isOpen: boolean;
		currentPath: string;
		onCloseMobile: () => void;
	} = $props();
</script>

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
