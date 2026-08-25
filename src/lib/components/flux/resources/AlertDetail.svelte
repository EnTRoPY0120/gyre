<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import AlertConfiguration from './AlertConfiguration.svelte';
	import AlertEventFilters from './AlertEventFilters.svelte';
	import AlertEventSources from './AlertEventSources.svelte';
	import type { AlertEventSource } from './alert-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});

	const providerRef = $derived(spec.providerRef as { name: string } | undefined);
	const eventSeverity = $derived(spec.eventSeverity as string | undefined);
	const eventSources = $derived(spec.eventSources as AlertEventSource[] | undefined);
	const inclusionList = $derived(spec.inclusionList as string[] | undefined);
	const exclusionList = $derived(spec.exclusionList as string[] | undefined);
	const summary = $derived(spec.summary as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
</script>

<div class="space-y-6">
	<AlertConfiguration {providerRef} {eventSeverity} {suspend} {summary} />
	<AlertEventSources {eventSources} />
	<AlertEventFilters {inclusionList} {exclusionList} />
</div>
