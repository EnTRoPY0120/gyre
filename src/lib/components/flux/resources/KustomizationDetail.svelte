<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import KustomizationBuildDetails from './KustomizationBuildDetails.svelte';
	import KustomizationReferences from './KustomizationReferences.svelte';
	import KustomizationRevisionStatus from './KustomizationRevisionStatus.svelte';
	import KustomizationSettings from './KustomizationSettings.svelte';
	import KustomizationSourceDetails from './KustomizationSourceDetails.svelte';
	import type {
		KustomizationDependency,
		KustomizationHealthCheck,
		KustomizationPostBuild,
		KustomizationSourceRef
	} from './kustomization-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const sourceRef = $derived(spec.sourceRef as KustomizationSourceRef | undefined);
	const path = $derived(spec.path as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const targetNamespace = $derived(spec.targetNamespace as string | undefined);
	const prune = $derived(spec.prune as boolean | undefined);
	const force = $derived(spec.force as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const healthChecks = $derived(spec.healthChecks as KustomizationHealthCheck[] | undefined);
	const dependsOn = $derived(spec.dependsOn as KustomizationDependency[] | undefined);
	const patches = $derived(spec.patches as unknown[] | undefined);
	const postBuild = $derived(spec.postBuild as KustomizationPostBuild | undefined);

	const lastAppliedRevision = $derived(status.lastAppliedRevision as string | undefined);
	const lastAttemptedRevision = $derived(status.lastAttemptedRevision as string | undefined);
	const lastHandledReconcileAt = $derived(
		(status as Record<string, unknown>).lastHandledReconcileAt as string | undefined
	);
</script>

<div class="space-y-6">
	<KustomizationSourceDetails {sourceRef} {path} {interval} {timeout} {targetNamespace} />
	<KustomizationSettings {prune} {force} {suspend} />
	<KustomizationRevisionStatus
		{lastAppliedRevision}
		{lastAttemptedRevision}
		{lastHandledReconcileAt}
	/>
	<KustomizationReferences {dependsOn} {healthChecks} />
	<KustomizationBuildDetails {patches} {postBuild} />
</div>
