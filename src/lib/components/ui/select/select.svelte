<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';

	let { value = $bindable(), ...restProps }: SelectPrimitive.RootProps = $props();
</script>

{#if restProps.type === 'single'}
	<SelectPrimitive.Root bind:value={value as string} {...restProps} />
{:else}
	<SelectPrimitive.Root bind:value={value as string[]} {...restProps} />
{/if}
