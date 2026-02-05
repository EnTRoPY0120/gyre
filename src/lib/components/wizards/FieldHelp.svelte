<script lang="ts">
	import { HelpCircle, ExternalLink } from 'lucide-svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let {
		helpText,
		docsUrl
	}: {
		helpText?: string;
		docsUrl?: string;
	} = $props();
</script>

{#if helpText || docsUrl}
	<Tooltip.Provider delayDuration={300}>
		<Tooltip.Root>
			<Tooltip.Trigger
				class="inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
				onclick={(e) => e.preventDefault()}
			>
				<HelpCircle size={14} />
			</Tooltip.Trigger>
			<Tooltip.Content side="top" align="start" class="max-w-sm">
				<div class="space-y-2">
					{#if helpText}
						<p class="leading-relaxed">{helpText}</p>
					{/if}
					{#if docsUrl}
						<a
							href={docsUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
						>
							View FluxCD Documentation
							<ExternalLink size={10} />
						</a>
					{/if}
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{/if}
