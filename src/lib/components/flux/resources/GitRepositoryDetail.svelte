<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { isSafeExternalUrl } from '$lib/utils/url';
	import GitRepositoryAdvancedConfiguration from './GitRepositoryAdvancedConfiguration.svelte';
	import GitRepositoryArtifactFields from './GitRepositoryArtifactFields.svelte';
	import GitRepositorySourceFields from './GitRepositorySourceFields.svelte';
	import type {
		GitRepositoryArtifact,
		GitRepositoryRef,
		GitRepositorySecretRef
	} from './git-repository-detail-types';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const isSafeUrl = $derived(isSafeExternalUrl(url));
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const ref = $derived(spec.ref as GitRepositoryRef | undefined);
	const secretRef = $derived(spec.secretRef as GitRepositorySecretRef | undefined);
	const ignore = $derived(spec.ignore as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const artifact = $derived(status.artifact as GitRepositoryArtifact | undefined);
</script>

<div class="space-y-6">
	<!-- Source & Sync Status -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Source & Sync Status
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			<GitRepositorySourceFields {url} {isSafeUrl} {ref} {interval} />
			<GitRepositoryArtifactFields {artifact} />
		</dl>
	</div>

	<GitRepositoryAdvancedConfiguration {timeout} {secretRef} {suspend} {ignore} />
</div>
