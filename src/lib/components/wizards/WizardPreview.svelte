<script lang="ts">
	import { AlertCircle, Check, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import type { ResourceTemplate } from '$lib/templates';

	let {
		template,
		mode,
		isSubmitting,
		success,
		isFormValid,
		error,
		onSubmit
	}: {
		template: ResourceTemplate;
		mode: 'wizard' | 'yaml';
		isSubmitting: boolean;
		success: boolean;
		isFormValid: boolean;
		error: string | null;
		onSubmit: () => void;
	} = $props();
</script>

<div class="flex flex-col gap-6">
	<div class="rounded-xl border border-border bg-card/60 p-6 backdrop-blur-sm">
		<h3 class="mb-4 font-semibold">Ready to Create?</h3>
		<p class="mb-6 text-sm text-muted-foreground">
			This will create a new {template.kind} in your cluster. Make sure the configuration is correct.
		</p>

		<Button
			class="w-full"
			size="lg"
			disabled={isSubmitting || success || (mode === 'wizard' && !isFormValid)}
			onclick={onSubmit}
		>
			{#if isSubmitting}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Creating...
			{:else if success}
				<Check class="mr-2 h-4 w-4" />
				Created!
			{:else}
				Create {template.kind}
			{/if}
		</Button>

		{#if error}
			<div
				class="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500"
			>
				<AlertCircle class="mt-0.5 shrink-0" size={16} />
				<span>{error}</span>
			</div>
		{/if}
	</div>

	<div class="rounded-xl border border-border bg-muted/30 p-6">
		<h4 class="mb-2 text-sm font-semibold">Tips</h4>
		<ul class="space-y-2 text-xs leading-relaxed text-muted-foreground">
			<li class="flex gap-2">
				<span class="text-primary">•</span>
				<span>Use <strong>Form mode</strong> for guided configuration with all available fields</span>
			</li>
			<li class="flex gap-2">
				<span class="text-primary">•</span>
				<span>Switch to <strong>Edit as YAML</strong> for direct manifest editing</span>
			</li>
			<li class="flex gap-2">
				<span class="text-primary">•</span>
				<span>Click <strong>Copy YAML</strong> to copy the generated manifest</span>
			</li>
		</ul>
	</div>
</div>
