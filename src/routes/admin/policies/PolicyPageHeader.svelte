<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	let { onCreate }: { onCreate: () => void } = $props();
</script>

<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
	<div>
		<h1 class="text-2xl font-bold text-white">RBAC Policies</h1>
		<p class="text-slate-400">Manage access control policies and user bindings</p>
	</div>
	<Button onclick={onCreate} class="w-full gap-2 sm:w-auto">
		<Plus class="h-4 w-4" />
		Create Policy
	</Button>
</div>
