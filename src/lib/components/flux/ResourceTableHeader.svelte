<script lang="ts">
	let {
		showAll,
		showNamespace,
		allDisplayedSelected,
		someDisplayedSelected,
		onToggleSelectAll
	}: {
		showAll: boolean;
		showNamespace: boolean;
		allDisplayedSelected: boolean;
		someDisplayedSelected: boolean;
		onToggleSelectAll: () => void;
	} = $props();
</script>

<thead
	class="{showAll ? 'sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]' : ''} border-b border-border bg-card"
>
	<tr>
		<th class="w-12 px-4 py-4">
			<input
				type="checkbox"
				checked={allDisplayedSelected}
				indeterminate={someDisplayedSelected}
				onchange={onToggleSelectAll}
				class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
				aria-label={showAll ? 'Select all resources' : 'Select all resources on current page'}
			/>
		</th>
		<th
			class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
		>
			Resource
		</th>
		{#if showNamespace}
			<th
				class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
			>
				Namespace
			</th>
		{/if}
		<th
			class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
		>
			Status
		</th>
		<th
			class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
		>
			Age
		</th>
		<th
			class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
		>
			Message
		</th>
	</tr>
</thead>
