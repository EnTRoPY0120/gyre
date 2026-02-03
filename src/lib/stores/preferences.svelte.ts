import { browser } from '$app/environment';

type CodeFormat = 'yaml' | 'json';

function createPreferencesStore() {
	let _format = $state<CodeFormat>(
		(browser && (localStorage.getItem('gyre_code_format') as CodeFormat)) || 'yaml'
	);

	return {
		get format() {
			return _format;
		},
		setFormat(newFormat: CodeFormat) {
			_format = newFormat;
			if (browser) {
				localStorage.setItem('gyre_code_format', newFormat);
			}
		},
		toggleFormat() {
			this.setFormat(_format === 'yaml' ? 'json' : 'yaml');
		}
	};
}

export const preferences = createPreferencesStore();
