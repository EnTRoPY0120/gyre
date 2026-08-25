<script lang="ts">
	import type * as Monaco from 'monaco-editor';
	import MonacoEditor from '$lib/components/editors/MonacoEditor.svelte';

	let {
		value = $bindable(),
		readonly,
		onValidation
	}: {
		value: string;
		readonly: boolean;
		onValidation: (errors: Monaco.editor.IMarker[]) => void;
	} = $props();
</script>

<div class="flex-1 overflow-hidden p-4 md:p-6">
	<div class="h-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
		<MonacoEditor
			bind:value
			language="yaml"
			{readonly}
			height="100%"
			lineNumbers="on"
			minimap={true}
			onValidation={onValidation}
		/>
	</div>
</div>
