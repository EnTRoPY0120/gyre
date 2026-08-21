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

<div
	class={cn(
		'mt-auto border-t border-sidebar-border/20 py-4 transition-all duration-300',
		isOpen ? 'px-3' : 'px-2'
	)}
>
	<a
		href="/admin"
		onclick={onCloseMobile}
		data-sveltekit-preload-data="hover"
		class={cn(
			'group flex items-center rounded-xl font-bold transition-all duration-300',
			isOpen ? 'gap-3 px-4 py-3 text-sm' : 'mx-auto justify-center p-2.5',
			currentPath.startsWith('/admin')
				? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_4px_20px_-4px_rgba(234,179,8,0.2)]'
				: 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
		)}
		aria-label={!isOpen ? 'Admin' : undefined}
	>
		<Icon
			name="settings"
			size={isOpen ? 18 : 22}
			class={cn(
				'shrink-0 transition-transform group-hover:scale-110',
				currentPath.startsWith('/admin') && 'animate-pulse'
			)}
		/>
		<span
			class={cn(
				'overflow-hidden whitespace-nowrap transition-all duration-300',
				isOpen ? 'opacity-100' : 'pointer-events-none w-0 opacity-0'
			)}
		>
			Admin
		</span>
	</a>
</div>
