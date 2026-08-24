<script lang="ts">
	import { formatTimestamp } from '$lib/utils/flux';
	import type { GitRepositoryArtifact } from './git-repository-detail-types';

	let { artifact }: { artifact: GitRepositoryArtifact | undefined } = $props();
</script>

{#if artifact?.revision}
	<div class="sm:col-span-2 mt-2 border-t border-gray-100 pt-4 dark:border-gray-700">
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Currently Synced Revision</dt>
		<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
			{artifact.revision}
		</dd>
	</div>
{/if}

{#if artifact?.lastUpdateTime}
	<div>
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
		<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
			{formatTimestamp(artifact.lastUpdateTime)}
		</dd>
	</div>
{/if}

{#if artifact?.path}
	<div>
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Artifact Path</dt>
		<dd class="mt-1 truncate font-mono text-sm text-gray-900 dark:text-gray-100" title={artifact.path}>
			{artifact.path}
		</dd>
	</div>
{/if}
