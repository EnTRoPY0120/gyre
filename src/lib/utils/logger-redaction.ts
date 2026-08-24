const SENSITIVE_KEYS =
	/^(password|token|secret|authorization|cookie|email|apiKey|bearer|credential|accessToken|refreshToken|clientSecret)$/i;

/**
 * Return a log-safe copy of a value without mutating the original object.
 * Circular references are replaced so browser console formatting cannot throw.
 */
export function redactSensitiveFields(
	value: unknown,
	visited: WeakSet<object> = new WeakSet()
): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) {
		if (visited.has(value)) return '[Circular]';
		visited.add(value);
		const result = value.map((item) => redactSensitiveFields(item, visited));
		visited.delete(value);
		return result;
	}
	if (value instanceof Error) {
		if (visited.has(value)) return '[Circular]';
		visited.add(value);
		const result: Record<string, unknown> = {
			name: value.name,
			message: value.message,
			stack: value.stack
		};
		for (const [key, nestedValue] of Object.entries(value)) {
			result[key] = SENSITIVE_KEYS.test(key)
				? '[REDACTED]'
				: redactSensitiveFields(nestedValue, visited);
		}
		visited.delete(value);
		return result;
	}
	if (typeof value === 'object') {
		if (visited.has(value)) return '[Circular]';
		visited.add(value);
		const result: Record<string, unknown> = {};
		for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
			result[key] = SENSITIVE_KEYS.test(key)
				? '[REDACTED]'
				: redactSensitiveFields(nestedValue, visited);
		}
		visited.delete(value);
		return result;
	}
	return value;
}
