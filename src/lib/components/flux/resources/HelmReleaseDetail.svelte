<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import HelmReleaseChartConfiguration from './HelmReleaseChartConfiguration.svelte';
	import HelmReleaseConfiguration from './HelmReleaseConfiguration.svelte';
	import HelmReleaseStatus from './HelmReleaseStatus.svelte';
	import HelmReleaseValues from './HelmReleaseValues.svelte';
	import type { HelmReleaseChart, HelmReleaseValuesFrom } from './helm-release-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const chart = $derived(spec.chart as HelmReleaseChart | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const releaseName = $derived(spec.releaseName as string | undefined);
	const targetNamespace = $derived(spec.targetNamespace as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const values = $derived(spec.values as Record<string, unknown> | undefined);
	const valuesFrom = $derived(spec.valuesFrom as HelmReleaseValuesFrom[] | undefined);

	const lastAppliedRevision = $derived(status.lastAppliedRevision as string | undefined);
	const lastAttemptedRevision = $derived(status.lastAttemptedRevision as string | undefined);
	const helmChart = $derived((status as Record<string, unknown>).helmChart as string | undefined);
</script>

<div class="space-y-6">
	<HelmReleaseChartConfiguration {chart} />
	<HelmReleaseConfiguration {releaseName} {targetNamespace} {interval} {timeout} {suspend} />
	<HelmReleaseStatus {lastAppliedRevision} {lastAttemptedRevision} {helmChart} />
	<HelmReleaseValues {valuesFrom} {values} />
</div>
