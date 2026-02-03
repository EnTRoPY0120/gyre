<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { FluxResourceType } from '$lib/types/flux';
	import { X, LayoutGrid, List, BarChart3, MessageSquare, History } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	let {
		isOpen,
		onClose,
		onSave,
		widget = null
	}: {
		isOpen: boolean;
		onClose: () => void;
		onSave: (widgetData: Record<string, unknown>) => void;
		widget?: Record<string, unknown> | null;
	} = $props();

	let step = $state(1);
	let selectedType = $state<string | null>(null);

	let title = $state('');
	let resourceType = $state<FluxResourceType>(FluxResourceType.GitRepository);
	let namespace = $state('');
	let limit = $state(5);
	let content = $state('');

	// Initialize if editing
	$effect(() => {
		if (isOpen && widget) {
			step = 2;
			selectedType = String(widget.type || '');
			title = String(widget.title || '');
			resourceType = (widget.resourceType as FluxResourceType) || FluxResourceType.GitRepository;
			const widgetConfig = widget.config
				? typeof widget.config === 'string'
					? JSON.parse(widget.config)
					: widget.config
				: {};
			namespace = String(widgetConfig.namespace || '');
			limit = Number(widgetConfig.limit || 5);
			content = String(widgetConfig.content || '');
		} else if (isOpen && !widget) {
			// Don't reset if we are just closing, wait for it to be open again
		}
	});

	const widgetTypes = [
		{
			id: 'resource-count',
			name: 'Resource Count',
			icon: LayoutGrid,
			desc: 'Show total count and health summary of a resource type'
		},
		{
			id: 'resource-list',
			name: 'Resource List',
			icon: List,
			desc: 'Display a scrollable list of recent resources'
		},
		{
			id: 'status-summary',
			name: 'Status Summary',
			icon: BarChart3,
			desc: 'Visual distribution of health across your cluster'
		},
		{
			id: 'recent-events',
			name: 'Recent Events',
			icon: History,
			desc: 'Real-time feed of reconciliation events'
		},
		{
			id: 'markdown',
			name: 'Notes / Text',
			icon: MessageSquare,
			desc: 'Add documentation or static text to your dashboard'
		}
	];

	function selectType(type: string) {
		selectedType = type;
		title = widgetTypes.find((t) => t.id === type)?.name || '';
		step = 2;
	}

	function handleSubmit() {
		const config: Record<string, unknown> = {};
		if (namespace) config.namespace = namespace;
		if (limit) config.limit = limit;
		if (content) config.content = content;

		onSave({
			...(widget ? { id: widget.id } : {}),
			type: selectedType,
			title,
			resourceType: selectedType === 'status-summary' && !resourceType ? null : resourceType,
			config: JSON.stringify(config),
			position: widget?.position || JSON.stringify({ x: 0, y: 0, w: 1, h: 1 })
		});

		reset();
		onClose();
	}

	function reset() {
		step = 1;
		selectedType = null;
		title = '';
		namespace = '';
		limit = 5;
		content = '';
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border/50 px-6 py-4">
				<div>
					<h2 class="text-xl font-black tracking-tight">
						{widget ? 'Edit Widget' : step === 1 ? 'Choose Widget Type' : `Configure ${title}`}
					</h2>
					<p class="text-xs font-medium text-muted-foreground text-primary/70 uppercase">
						{step === 1
							? 'Select a visualization for your dashboard'
							: 'Customize how the widget looks and behaves'}
					</p>
				</div>
				<button
					onclick={onClose}
					class="rounded-full p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
				>
					<X class="size-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="max-h-[70vh] overflow-y-auto p-6">
				{#if step === 1}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each widgetTypes as type (type.id)}
							<button
								onclick={() => selectType(type.id)}
								class="group flex flex-col items-start rounded-xl border border-border/50 bg-muted/5 p-4 text-left transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-primary/5"
							>
								<div
									class="mb-3 rounded-lg bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
								>
									<type.icon class="size-5" />
								</div>
								<h3 class="mb-1 text-sm font-bold">{type.name}</h3>
								<p class="text-xs leading-relaxed text-muted-foreground">{type.desc}</p>
							</button>
						{/each}
					</div>
				{:else}
					<div class="space-y-6">
						<div class="space-y-2">
							<Label for="widget-title">Widget Title</Label>
							<Input id="widget-title" bind:value={title} placeholder="Enter widget title..." />
						</div>

						{#if selectedType === 'resource-count' || selectedType === 'resource-list' || selectedType === 'status-summary'}
							<div class="grid grid-cols-2 gap-4">
								<div class="space-y-2">
									<Label for="res-type">Resource Type</Label>
									<select
										id="res-type"
										bind:value={resourceType}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
									>
										{#each Object.entries(FluxResourceType) as [name, value] (name)}
											<option {value}>{name}</option>
										{/each}
									</select>
								</div>
								<div class="space-y-2">
									<Label for="res-ns">Namespace (Optional)</Label>
									<Input id="res-ns" bind:value={namespace} placeholder="All namespaces..." />
								</div>
							</div>
						{/if}

						{#if selectedType === 'resource-list' || selectedType === 'recent-events'}
							<div class="space-y-2">
								<Label for="res-limit">Display Limit</Label>
								<Input id="res-limit" type="number" bind:value={limit} min="1" max="20" />
							</div>
						{/if}

						{#if selectedType === 'markdown'}
							<div class="space-y-2">
								<Label for="md-content">Content (Markdown)</Label>
								<Textarea
									id="md-content"
									bind:value={content}
									placeholder="Add notes, links, or instructions..."
									rows={6}
								/>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-4"
			>
				{#if step === 2 && !widget}
					<Button variant="ghost" onclick={() => (step = 1)}>Back</Button>
				{:else}
					<div></div>
				{/if}

				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={() => {
							reset();
							onClose();
						}}>Cancel</Button
					>
					{#if step === 2}
						<Button onclick={handleSubmit}>{widget ? 'Save Changes' : 'Add to Dashboard'}</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Scale and fade animations for a premium feel */
	.fixed {
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
