<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import type { ClusterHealthCheck } from '$lib/server/clusters';

	let {
		form,
		urlError,
		onViewHealthCheck
	}: {
		form:
			| {
				error?: string;
				success?: boolean;
				healthCheck?: ClusterHealthCheck;
			}
			| undefined;
		urlError: string | null;
		onViewHealthCheck: () => void;
	} = $props();
</script>

<!-- Error Message (from form action or middleware redirect) -->
{#if form?.error || urlError}
	<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			{form?.error ?? urlError}
		</div>
	</div>
{/if}

<!-- Success Message -->
{#if form?.success}
	<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				<span class="font-medium">Connection successful!</span>
			</div>
			{#if form?.healthCheck}
				<Button
					variant="ghost"
					size="sm"
					onclick={onViewHealthCheck}
					class="text-emerald-300 hover:text-emerald-200"
				>
					View Details
				</Button>
			{/if}
		</div>
	</div>
{/if}

<!-- Error Message with Details Button -->
{#if form?.error && form?.healthCheck}
	<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span class="font-medium">Connection failed</span>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onclick={onViewHealthCheck}
				class="text-red-300 hover:text-red-200"
			>
				View Diagnostics
			</Button>
		</div>
		<p class="mt-2 text-sm">
			Connection checks failed. Open diagnostics for the detailed failure reason and checklist.
		</p>
	</div>
{:else if form?.error}
	<div class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			{form.error}
		</div>
	</div>
{/if}
