<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let { class: className, ...rest }: TooltipPrimitive.TriggerProps = $props();
</script>

<TooltipPrimitive.Trigger class={cn('', className)} {...rest} />
