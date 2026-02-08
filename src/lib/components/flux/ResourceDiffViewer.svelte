<script lang="ts">
	import MonacoDiffEditor from '$lib/components/editors/MonacoDiffEditor.svelte';
	import { FileDiff, CheckCircle2, PlusCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface ResourceDiff {
		kind: string;
		name: string;
		namespace: string;
		desired: string;
		live: string | null;
	}

	let { diffs }: { diffs: ResourceDiff[] } = $props();

	let selectedIndex = $state(0);

	const selectedDiff = $derived(diffs[selectedIndex]);
</script>

<div
	class="grid h-[600px] grid-cols-[300px_1fr] overflow-hidden rounded-xl border border-border bg-card shadow-sm"
>
	<!-- Sidebar: Resource List -->
	<div class="flex flex-col border-r border-border bg-muted/30">
		<div class="border-b border-border p-4">
			<h3 class="flex items-center gap-2 text-sm font-semibold">
				<FileDiff size={16} class="text-primary" />
				Resources ({diffs.length})
			</h3>
		</div>
		<div class="flex-1 overflow-y-auto p-2">
			<div class="space-y-1">
				{#each diffs as diff, i (i)}
					<button
						onclick={() => (selectedIndex = i)}
						class={cn(
							'flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-all',
							selectedIndex === i ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-accent/50'
						)}
					>
						<div class="flex items-center justify-between">
							<span class="truncate text-xs font-semibold text-foreground">
								{diff.name}
							</span>
							{#if !diff.live}
								<span title="New Resource">
									<PlusCircle size={12} class="text-green-500" />
								</span>
							{:else if diff.desired === diff.live}
								<span title="In Sync">
									<CheckCircle2 size={12} class="text-blue-500" />
								</span>
							{:else}
								<div class="size-2 rounded-full bg-amber-500" title="Drifted"></div>
							{/if}
						</div>
						<div class="flex items-center gap-2 text-[10px] text-muted-foreground">
							<span class="rounded bg-muted px-1 py-0.5">{diff.kind}</span>
							<span class="truncate">{diff.namespace}</span>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Main Content: Diff Editor -->
	<div class="flex flex-col overflow-hidden bg-background">
		{#if selectedDiff}
			<div class="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
				<div class="flex items-center gap-3">
					<div class="flex flex-col">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-bold">{selectedDiff.name}</h4>
							<span
								class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
							>
								{selectedDiff.kind}
							</span>
						</div>
						<p class="text-[10px] text-muted-foreground">Comparing Git (Left) vs Cluster (Right)</p>
					</div>
				</div>

				{#if !selectedDiff.live}
					<span
						class="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
					>
						New Resource
					</span>
				{:else if selectedDiff.desired === selectedDiff.live}
					<span
						class="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
					>
						In Sync
					</span>
				{:else}
					<span
						class="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
					>
						Drift Detected
					</span>
				{/if}
			</div>

			<div class="flex-1 overflow-hidden">
				<MonacoDiffEditor
					original={selectedDiff.desired}
					modified={selectedDiff.live || ''}
					language="yaml"
					height="100%"
					readonly={true}
				/>
			</div>
		{:else}
			<div
				class="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground"
			>
				<FileDiff size={48} class="mb-4 opacity-20" />
				<p>Select a resource to view its drift</p>
			</div>
		{/if}
	</div>
</div>
