<script lang="ts">
	import type { DashboardWidget } from '$lib/stores/dashboards.svelte';

	let { widget, config }: { widget: DashboardWidget; config: Record<string, unknown> } = $props();

	let content = $derived(String(config.content || ''));
</script>

<div
	class="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 first:prose-headings:mt-0 prose-p:leading-relaxed"
	data-widget-id={widget.id}
>
	{#if !content}
		<div class="py-4 text-center text-xs text-muted-foreground italic">
			No content provided. Use widget settings to add Markdown.
		</div>
	{:else}
		<!-- Simple markdown-like rendering or just pre/text for now -->
		<div class="text-sm whitespace-pre-wrap text-foreground/80">
			{content}
		</div>
	{/if}
</div>
