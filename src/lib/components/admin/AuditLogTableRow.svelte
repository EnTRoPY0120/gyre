<script lang="ts">
	import {
		CheckCircle2,
		ChevronDown,
		ChevronUp,
		Globe,
		Shield,
		User,
		XCircle
	} from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { AuditLog } from '../../../routes/admin/audit-logs/audit-log-types';
	import AuditLogDetails from './AuditLogDetails.svelte';

	let {
		log,
		expanded,
		actionColor,
		relativeTimestamp,
		onToggle
	}: {
		log: AuditLog;
		expanded: boolean;
		actionColor: string;
		relativeTimestamp: string;
		onToggle: () => void;
	} = $props();
</script>

<tr class={cn('transition-colors hover:bg-slate-700/30', expanded && 'bg-slate-700/20')}>
	<td class="px-4 py-3 whitespace-nowrap text-slate-300">
		<div class="flex flex-col">
			<span class="font-medium text-white">{new Date(log.createdAt).toLocaleTimeString()}</span>
			<span class="text-[10px] text-slate-500 uppercase">{relativeTimestamp}</span>
		</div>
	</td>
	<td class="px-4 py-3">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700">
				<User size={12} class="text-slate-400" />
			</div>
			<span class="font-medium text-slate-200">{log.user?.username || 'System'}</span>
		</div>
	</td>
	<td class="px-4 py-3">
		<span
			class={cn(
				'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
				actionColor
			)}
		>
			{log.action}
		</span>
	</td>
	<td class="px-4 py-3">
		{#if log.resourceType}
			<div class="flex flex-col">
				<span class="font-medium text-white">{log.resourceName || '-'}</span>
				<span class="text-[10px] text-slate-500 uppercase">{log.resourceType}</span>
			</div>
		{:else}
			<span class="text-slate-500">-</span>
		{/if}
	</td>
	<td class="hidden px-4 py-3 lg:table-cell">
		<div class="flex flex-col text-[11px]">
			{#if log.namespace}
				<div class="flex items-center gap-1 text-slate-400">
					<Globe size={10} />
					<span>{log.namespace}</span>
				</div>
			{/if}
			{#if log.clusterId}
				<div class="flex items-center gap-1 text-slate-500">
					<Shield size={10} />
					<span>{log.clusterId}</span>
				</div>
			{/if}
			{#if !log.namespace && !log.clusterId}
				<span class="text-slate-600">Global</span>
			{/if}
		</div>
	</td>
	<td class="px-4 py-3">
		{#if log.success}
			<CheckCircle2 size={16} class="text-emerald-500" />
		{:else}
			<XCircle size={16} class="text-red-500" />
		{/if}
	</td>
	<td class="px-4 py-3 text-right">
		<button
			onclick={onToggle}
			class="text-slate-500 transition-colors hover:text-white"
			aria-expanded={expanded}
			aria-controls={`log-details-${log.id}`}
			aria-label={expanded ? 'Collapse log details' : 'Expand log details'}
		>
			{#if expanded}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
		</button>
	</td>
</tr>

{#if expanded}
	<AuditLogDetails {log} />
{/if}
