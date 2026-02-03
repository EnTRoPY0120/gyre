<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		value = $bindable(''),
		label,
		error,
		readonly = false,
		className
	}: {
		value: string;
		label?: string;
		error?: string | null;
		readonly?: boolean;
		className?: string;
	} = $props();

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const textarea = e.target as HTMLTextAreaElement;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;

			// Set textarea value to: text before caret + tab + text after caret
			value = value.substring(0, start) + '  ' + value.substring(end);

			// Put caret at right position again
			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd = start + 2;
			}, 0);
		}
	}
</script>

<div class={cn('flex flex-col gap-1.5', className)}>
	{#if label}
		<label for="yaml-editor" class="text-sm font-medium text-foreground">{label}</label>
	{/if}

	<div class="relative flex-1">
		<textarea
			id="yaml-editor"
			bind:value
			onkeydown={handleKeyDown}
			readonly={readonly}
			spellcheck="false"
			class={cn(
				'min-h-[300px] w-full resize-none rounded-lg border border-border bg-zinc-950 p-4 font-mono text-sm text-zinc-100 outline-none transition-all placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20',
				error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
				readonly && 'cursor-not-allowed opacity-70'
			)}
			placeholder="# Enter YAML here..."
		></textarea>

		{#if error}
			<p class="mt-1 text-xs text-red-500">{error}</p>
		{/if}
	</div>
</div>
