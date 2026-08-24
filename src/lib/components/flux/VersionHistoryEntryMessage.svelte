<script lang="ts">
	import { formatDistanceToNow } from 'date-fns';
	import type { ReconciliationEntry } from '$lib/types/reconciliation';
	import VersionHistoryEntryDetails from './VersionHistoryEntryDetails.svelte';
	import VersionHistoryEntryPreview from './VersionHistoryEntryPreview.svelte';

	let {
		entry,
		expanded,
		onToggle
	}: {
		entry: ReconciliationEntry;
		expanded: boolean;
		onToggle: () => void;
	} = $props();
</script>

<VersionHistoryEntryPreview {entry} {expanded} {onToggle} />
<VersionHistoryEntryDetails {entry} {expanded} />
<p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
	{formatDistanceToNow(new Date(entry.reconcileCompletedAt), { addSuffix: true })}
	· {new Date(entry.reconcileCompletedAt).toLocaleString()}
</p>
