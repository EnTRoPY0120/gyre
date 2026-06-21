import { Tooltip as TooltipPrimitive } from 'bits-ui';

import Provider from './tooltip-provider.svelte';
import Root from './tooltip.svelte';
import Trigger from './tooltip-trigger.svelte';
import Content from './tooltip-content.svelte';

const Portal = TooltipPrimitive.Portal;

export { Root, Trigger, Content, Provider };
