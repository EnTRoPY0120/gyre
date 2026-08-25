<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import type { GitRepositoryRef } from './git-repository-detail-types';

	let {
		url,
		isSafeUrl,
		ref,
		interval
	}: {
		url: string | undefined;
		isSafeUrl: boolean;
		ref: GitRepositoryRef | undefined;
		interval: string | undefined;
	} = $props();
</script>

{#if url}
	<div class="sm:col-span-2">
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Repository URL</dt>
		<dd class="mt-1">
			{#if isSafeUrl}
				<a
					href={url}
					target="_blank"
					rel="external noopener noreferrer"
					class="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
					{url}
				</a>
			{:else}
				<span class="text-sm text-gray-900 dark:text-gray-100">{url}</span>
			{/if}
		</dd>
	</div>
{/if}

{#if ref}
	<div>
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Git Reference</dt>
		<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
			{#if ref.branch}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
					branch: {ref.branch}
				</span>
			{:else if ref.tag}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
						/>
					</svg>
					tag: {ref.tag}
				</span>
			{:else if ref.semver}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
				>
					semver: {ref.semver}
				</span>
			{:else if ref.commit}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
				>
					{ref.commit.substring(0, 12)}
				</span>
			{/if}
		</dd>
	</div>
{/if}

{#if interval}
	<DetailField label="Sync Interval">
		<span class="text-sm text-gray-900 dark:text-gray-100">{interval}</span>
	</DetailField>
{/if}
