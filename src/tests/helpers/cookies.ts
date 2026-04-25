export function createCookies(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const deleted: Array<{ name: string; options: Record<string, unknown> }> = [];
	const setCalls: Array<{
		name: string;
		options: Record<string, unknown>;
		value: string;
	}> = [];

	return {
		delete(name: string, options: Record<string, unknown>) {
			values.delete(name);
			deleted.push({ name, options });
		},
		deleted,
		get(name: string) {
			return values.get(name);
		},
		set(name: string, value: string, options: Record<string, unknown>) {
			values.set(name, value);
			setCalls.push({ name, options, value });
		},
		setCalls,
		values
	};
}
