<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	let {
		isOpen,
		gyreVersion,
		onToggle,
		onCloseMobile
	}: {
		isOpen: boolean;
		gyreVersion: string;
		onToggle: () => void;
		onCloseMobile: () => void;
	} = $props();
</script>

<div
	class={cn(
		'flex h-20 shrink-0 flex-col justify-center border-b border-sidebar-border transition-all duration-300',
		isOpen ? 'px-4' : 'px-0'
	)}
>
	<div class={cn('flex items-center overflow-hidden', isOpen ? 'justify-between' : 'justify-center')}>
		{#if isOpen}
			<a
				href="/"
				class="group flex items-center gap-3 overflow-hidden"
				onclick={onCloseMobile}
				data-sveltekit-preload-data="hover"
			>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20 transition-all group-hover:scale-105 group-hover:shadow-amber-500/30"
				>
					<svg class="h-6 w-6 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
					</svg>
				</div>
				<div class="flex flex-col transition-all duration-300">
					<div class="flex items-start gap-1 whitespace-nowrap">
						<span class="text-xl leading-tight font-bold tracking-tight text-foreground">Gyre</span>
						<span
							class="inline-flex items-center rounded-md border border-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500/50"
						>
							alpha
						</span>
					</div>
					<span
						class="mt-0.5 inline-flex w-fit items-center rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary whitespace-nowrap"
					>
						v{gyreVersion}
					</span>
				</div>
			</a>

			<button
				type="button"
				onclick={onToggle}
				class="rounded-lg p-2 text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95"
				aria-label="Collapse Sidebar"
			>
				<Icon name="chevron-left" size={20} />
			</button>
		{:else}
			<button
				type="button"
				onclick={onToggle}
				class="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-primary active:scale-95"
				aria-label="Expand Sidebar"
			>
				<Icon name="menu" size={24} />
			</button>
		{/if}
	</div>
</div>
