<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';

	let { open = $bindable(false), ...rest }: TooltipPrimitive.RootProps = $props();
</script>

<TooltipPrimitive.Root bind:open {...rest} />
