<script lang="ts">
	import { cn } from '$lib/utils';
	import { Copy, Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import MonacoEditor from './MonacoEditor.svelte';

	let {
		value = $bindable(''),
		label,
		error,
		readonly = false,
		className,
		onCopy,
		copySuccess = false
	}: {
		value: string;
		label?: string;
		error?: string | null;
		readonly?: boolean;
		className?: string;
		onCopy?: () => void;
		copySuccess?: boolean;
	} = $props();

	// Handle value changes from Monaco
	function handleChange(newValue: string) {
		value = newValue;
	}
</script>

<div class={cn('flex h-full flex-col gap-1.5', className)}>
	{#if label}
		<label for="yaml-editor" class="text-sm font-medium text-foreground">{label}</label>
	{/if}

	<div class="relative flex-1 overflow-hidden rounded-lg border border-border bg-zinc-950">
		<!-- Copy button positioned inside the editor -->
		{#if onCopy}
			<div class="absolute top-3 right-3 z-10">
				<Button
					variant="secondary"
					size="sm"
					onclick={onCopy}
					class="h-8 gap-1.5 bg-zinc-800/90 px-3 text-xs text-zinc-100 hover:bg-zinc-700"
				>
					{#if copySuccess}
						<Check size={14} class="text-green-400" />
						<span>Copied!</span>
					{:else}
						<Copy size={14} />
						<span>Copy YAML</span>
					{/if}
				</Button>
			</div>
		{/if}

		<!-- Monaco Editor -->
		<MonacoEditor
			bind:value
			language="yaml"
			{readonly}
			height="100%"
			lineNumbers="on"
			minimap={false}
			onChange={handleChange}
			className="h-full"
		/>

		{#if error}
			<p
				class="absolute bottom-3 left-3 mt-1 rounded bg-zinc-900/90 px-2 py-1 text-xs text-red-500"
			>
				{error}
			</p>
		{/if}
	</div>
</div>
