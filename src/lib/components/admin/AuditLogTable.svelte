<script lang="ts">
	import { Shield } from '@lucide/svelte';
	import AuditLogTableHeader from './AuditLogTableHeader.svelte';
	import AuditLogTableRow from './AuditLogTableRow.svelte';
	import type { AuditLog } from '../../../routes/admin/audit-logs/audit-log-types';

	let {
		logs,
		expandedLogId,
		actionColor,
		relativeTimestamp,
		sortBy,
		sortOrder,
		onToggleExpand,
		onSort
	}: {
		logs: AuditLog[];
		expandedLogId: string | null;
		actionColor: (action: string) => string;
		relativeTimestamp: (date: Date) => string;
		sortBy: 'date' | 'action';
		sortOrder: 'asc' | 'desc';
		onToggleExpand: (id: string) => void;
		onSort: (column: 'date' | 'action') => void;
	} = $props();
</script>

<div class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<AuditLogTableHeader {sortBy} {sortOrder} {onSort} />
			<tbody class="divide-y divide-slate-700/50">
				{#each logs as log (log.id)}
					<AuditLogTableRow
						{log}
						expanded={expandedLogId === log.id}
						actionColor={actionColor(log.action)}
						relativeTimestamp={relativeTimestamp(log.createdAt)}
						onToggle={() => onToggleExpand(log.id)}
					/>
				{/each}
			</tbody>
		</table>
	</div>

	{#if logs.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-slate-500">
			<Shield size={48} class="mb-4 opacity-20" />
			<p>No audit logs found</p>
		</div>
	{/if}
</div>
