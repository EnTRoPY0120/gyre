<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { getResourceHealth, getHealthLabel } from '$lib/utils/flux';

	interface Props {
		conditions?: K8sCondition[];
		suspended?: boolean;
	}

	let { conditions, suspended = false }: Props = $props();

	const health = $derived(getResourceHealth(conditions, suspended));
	const label = $derived(getHealthLabel(health));

	const colorClasses = $derived.by(() => {
		switch (health) {
			case 'healthy':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'progressing':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			case 'failed':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'suspended':
				return 'bg-gray-100 text-gray-800 border-gray-200';
			default:
				return 'bg-gray-100 text-gray-600 border-gray-200';
		}
	});
</script>

<span
	class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold {colorClasses}"
>
	{label}
</span>
