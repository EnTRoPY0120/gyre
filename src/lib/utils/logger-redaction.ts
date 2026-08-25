const SENSITIVE_KEYS =
	/^(password|token|secret|authorization|cookie|email|apiKey|bearer|credential|accessToken|refreshToken|clientSecret)$/i;

function redactEntries(
	entries: [string, unknown][],
	visited: WeakSet<object>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, nestedValue] of entries) {
		result[key] = SENSITIVE_KEYS.test(key)
			? '[REDACTED]'
			: redactSensitiveFields(nestedValue, visited);
	}
	return result;
}

function redactArray(value: unknown[], visited: WeakSet<object>): unknown {
	if (visited.has(value)) return '[Circular]';
	visited.add(value);
	const result = value.map((item) => redactSensitiveFields(item, visited));
	visited.delete(value);
	return result;
}

function redactError(value: Error, visited: WeakSet<object>): unknown {
	if (visited.has(value)) return '[Circular]';
	visited.add(value);
	const result = {
		name: value.name,
		message: value.message,
		stack: value.stack,
		...redactEntries(Object.entries(value), visited)
	};
	visited.delete(value);
	return result;
}

function redactObject(value: object, visited: WeakSet<object>): unknown {
	if (visited.has(value)) return '[Circular]';
	visited.add(value);
	const result = redactEntries(Object.entries(value as Record<string, unknown>), visited);
	visited.delete(value);
	return result;
}

/**
 * Return a log-safe copy of a value without mutating the original object.
 * Circular references are replaced so browser console formatting cannot throw.
 */
export function redactSensitiveFields(
	value: unknown,
	visited: WeakSet<object> = new WeakSet()
): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) return redactArray(value, visited);
	if (value instanceof Error) return redactError(value, visited);
	if (typeof value === 'object') return redactObject(value, visited);
	return value;
}
