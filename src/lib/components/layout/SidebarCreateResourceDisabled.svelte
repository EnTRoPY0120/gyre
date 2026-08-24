<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';

	let { isOpen }: { isOpen: boolean } = $props();
</script>

<Tooltip.Provider delayDuration={200}>
	<Tooltip.Root>
		<Tooltip.Trigger class="w-full">
			{#snippet child({ props })}
				<span {...props}>
					<button
						type="button"
						aria-disabled="true"
						class={cn(
							'group flex w-full cursor-not-allowed items-center rounded-xl text-muted-foreground opacity-60 transition-all duration-300',
							isOpen ? 'gap-3 px-4 py-3 text-sm font-bold' : 'justify-center p-2.5'
						)}
					>
						<div
							class={cn(
								'flex shrink-0 items-center justify-center rounded-md bg-primary/10 transition-colors',
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
					</button>
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="right">
			<p class="text-xs text-white">You need additional permissions to create resources.</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
