export function importFresh<TModule>(path: string): Promise<TModule> {
	const moduleUrl = new URL(path, new URL('../', import.meta.url));
	moduleUrl.search = '';
	return import(moduleUrl.href) as Promise<TModule>;
}
