<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let {
		canWrite,
		action,
		children
	}: {
		canWrite: boolean;
		action: string;
		children?: Snippet;
	} = $props();
</script>

{#if !canWrite}
	<Tooltip.Provider delayDuration={200}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<span {...props}>
						{@render children?.()}
					</span>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side="top">
				<p class="text-xs">You need additional permissions to {action} resources.</p>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
{:else}
	{@render children?.()}
{/if}
