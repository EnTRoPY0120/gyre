<script lang="ts">
	import type { AuditLog } from '../../../routes/admin/audit-logs/audit-log-types';

	let { log }: { log: AuditLog } = $props();
</script>

<tr class="bg-slate-900/40" id={`log-details-${log.id}`}>
	<td colspan="7" class="px-6 py-4">
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="space-y-4">
				<div>
					<h4 class="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">Event Details</h4>
					<div class="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-amber-400/80">
						<pre>{JSON.stringify(log.details, null, 2)}</pre>
					</div>
				</div>
			</div>
			<div class="space-y-4">
				<div>
					<h4 class="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">Metadata</h4>
					<div class="space-y-2">
						<div class="flex justify-between border-b border-slate-800 pb-1">
							<span class="text-slate-400">Log ID</span>
							<span class="font-mono text-[10px] text-slate-200">{log.id}</span>
						</div>
						<div class="flex justify-between border-b border-slate-800 pb-1">
							<span class="text-slate-400">IP Address</span>
							<span class="text-slate-200">{log.ipAddress || 'Internal'}</span>
						</div>
						<div class="flex justify-between border-b border-slate-800 pb-1">
							<span class="text-slate-400">User Email</span>
							<span class="text-slate-200">{log.user?.email || 'N/A'}</span>
						</div>
						<div class="flex justify-between border-b border-slate-800 pb-1">
							<span class="text-slate-400">Full Timestamp</span>
							<span class="text-slate-200">{new Date(log.createdAt).toISOString()}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</td>
</tr>
