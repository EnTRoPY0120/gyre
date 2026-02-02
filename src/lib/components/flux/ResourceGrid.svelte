<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onCardClick?: (resource: FluxResource) => void;
	}

	let { resources, showNamespace = true, onCardClick }: Props = $props();

	function handleCardClick(resource: FluxResource) {
		if (onCardClick) {
			onCardClick(resource);
		}
	}

	function getReadyMessage(resource: FluxResource): string {
		const ready = resource.status?.conditions?.find((c) => c.type === 'Ready');
		return ready?.message || 'No status message';
	}
</script>

{#if resources.length === 0}
	<div class="rounded-xl border border-border bg-card/40 p-12 text-center backdrop-blur-sm">
		<p class="font-medium text-muted-foreground">No resources found</p>
		<p class="mt-1 text-xs text-muted-foreground/60">Try adjusting your filters.</p>
	</div>
{:else}
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each resources as resource}
			<button
				type="button"
				class="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/40 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-card/80 hover:shadow-lg"
				onclick={() => handleCardClick(resource)}
			>
				<!-- Hover Glow -->
				<div
					class="absolute -top-12 -right-12 size-24 rounded-full bg-primary/10 opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100"
				></div>

				<div class="relative z-10 flex w-full items-start justify-between">
					<div class="min-w-0 flex-1 pr-2">
						<h3
							class="truncate font-mono text-sm font-bold text-foreground transition-colors group-hover:text-primary"
						>
							{resource.metadata.name}
						</h3>
						{#if showNamespace && resource.metadata.namespace}
							<p
								class="mt-1 text-[10px] font-black tracking-wider text-muted-foreground/70 uppercase"
							>
								{resource.metadata.namespace}
							</p>
						{/if}
					</div>
					<div class="flex-shrink-0">
						<StatusBadge
							conditions={resource.status?.conditions}
							suspended={resource.spec?.suspend as boolean | undefined}
							size="sm"
						/>
					</div>
				</div>

				<p class="mt-4 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
					{getReadyMessage(resource)}
				</p>

				<div class="mt-4 flex w-full items-center justify-between border-t border-border/50 pt-3">
					<span class="font-mono text-[10px] font-medium text-muted-foreground/60">
						{formatTimestamp(resource.metadata.creationTimestamp)}
					</span>
					<div
						class="size-1.5 rounded-full bg-border transition-colors group-hover:bg-primary"
					></div>
				</div>
			</button>
		{/each}
	</div>
{/if}
