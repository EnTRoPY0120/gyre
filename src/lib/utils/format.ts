import yaml from 'js-yaml';
import { logger } from './logger.js';

/**
 * Convert an object to a formatted YAML string
 */
export function toYaml(obj: Record<string, unknown>): string {
	try {
		return yaml.dump(obj, {
			indent: 2,
			noRefs: true,
			sortKeys: false,
			lineWidth: -1 // Disable line wrapping
		});
	} catch (e) {
		logger.error(e, 'YAML conversion error:');
		return 'Error converting to YAML';
	}
}

/**
 * Convert an object to a formatted JSON string
 */
export function toJson(obj: Record<string, unknown>): string {
	try {
		return JSON.stringify(obj, null, 2);
	} catch (e) {
		logger.error(e, 'JSON conversion error:');
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
		logger.error(err, 'Failed to copy text: ');
		return false;
	}
}
