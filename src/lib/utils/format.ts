import yaml from 'js-yaml';

/**
 * Convert an object to a formatted YAML string
 */
export function toYaml(obj: any): string {
	try {
		return yaml.dump(obj, {
			indent: 2,
			noRefs: true,
			sortKeys: false,
			lineWidth: -1 // Disable line wrapping
		});
	} catch (e) {
		console.error('YAML conversion error:', e);
		return 'Error converting to YAML';
	}
}

/**
 * Convert an object to a formatted JSON string
 */
export function toJson(obj: any): string {
	try {
		return JSON.stringify(obj, null, 2);
	} catch (e) {
		console.error('JSON conversion error:', e);
		return 'Error converting to JSON';
	}
}

/**
 * Copy text to clipboard using the modern API
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (err) {
		console.error('Failed to copy text: ', err);
		return false;
	}
}
