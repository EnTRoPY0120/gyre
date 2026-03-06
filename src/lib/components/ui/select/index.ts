import { Select as SelectPrimitive } from 'bits-ui';

import Root from './select.svelte';
import Content from './select-content.svelte';
import Group from './select-group.svelte';
import Item from './select-item.svelte';
import Label from './select-label.svelte';
import ScrollDownButton from './select-scroll-down-button.svelte';
import ScrollUpButton from './select-scroll-up-button.svelte';
import Separator from './select-separator.svelte';
import Trigger from './select-trigger.svelte';
import Value from './select-value.svelte';

const GroupHeading = SelectPrimitive.GroupHeading;

export {
	Root,
	Content,
	Group,
	Item,
	Label,
	ScrollDownButton,
	ScrollUpButton,
	Separator,
	Trigger,
	Value,
	GroupHeading,
	//
	Root as Select,
	Content as SelectContent,
	Group as SelectGroup,
	Item as SelectItem,
	Label as SelectLabel,
	ScrollDownButton as SelectScrollDownButton,
	ScrollUpButton as SelectScrollUpButton,
	Separator as SelectSeparator,
	Trigger as SelectTrigger,
	Value as SelectValue,
	GroupHeading as SelectGroupHeading
};
