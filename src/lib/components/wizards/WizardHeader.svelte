<script lang="ts">
	import { Code, ListChecks } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { ResourceTemplate } from '$lib/templates';

	let {
		template,
		mode,
		onToggleMode
	}: {
		template: ResourceTemplate;
		mode: 'wizard' | 'yaml';
		onToggleMode: (mode: 'wizard' | 'yaml') => void;
	} = $props();
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h2 class="text-xl font-bold">{template.name} Creation</h2>
		<p class="text-sm text-muted-foreground">{template.description}</p>
	</div>

	<div class="flex items-center gap-2">
		<div class="flex shrink-0 rounded-lg border border-border bg-card p-1">
			<button
				type="button"
				class={cn(
					'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
					mode === 'wizard' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
				)}
				onclick={() => onToggleMode('wizard')}
			>
				<ListChecks size={16} />
				Form
			</button>
			<button
				type="button"
				class={cn(
					'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
					mode === 'yaml' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
				)}
				onclick={() => onToggleMode('yaml')}
			>
				<Code size={16} />
				Edit as YAML
			</button>
		</div>
	</div>
</div>
