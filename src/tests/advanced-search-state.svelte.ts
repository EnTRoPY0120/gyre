import { defaultFilterState, type FilterState } from '../lib/utils/filtering';

class AdvancedSearchState {
	filters = $state<FilterState>({ ...defaultFilterState });
}

export function createAdvancedSearchFilterState(): FilterState {
	return new AdvancedSearchState().filters;
}
