async function getJsonWorker(): Promise<Worker> {
	const { default: JsonWorker } = await import('monaco-editor/language/json/json.worker?worker');
	return new JsonWorker();
}

async function getCssWorker(): Promise<Worker> {
	const { default: CssWorker } = await import('monaco-editor/language/css/css.worker?worker');
	return new CssWorker();
}

async function getHtmlWorker(): Promise<Worker> {
	const { default: HtmlWorker } = await import('monaco-editor/language/html/html.worker?worker');
	return new HtmlWorker();
}

async function getTypescriptWorker(): Promise<Worker> {
	const { default: TsWorker } = await import('monaco-editor/language/typescript/ts.worker?worker');
	return new TsWorker();
}

async function getEditorWorker(): Promise<Worker> {
	const { default: EditorWorker } = await import('monaco-editor/editor/editor.worker?worker');
	return new EditorWorker();
}

const WORKER_LOADERS: Record<string, () => Promise<Worker>> = {
	json: getJsonWorker,
	css: getCssWorker,
	scss: getCssWorker,
	less: getCssWorker,
	html: getHtmlWorker,
	handlebars: getHtmlWorker,
	razor: getHtmlWorker,
	typescript: getTypescriptWorker,
	javascript: getTypescriptWorker
};

export function getMonacoWorker(_moduleId: string, label: string): Promise<Worker> {
	return (WORKER_LOADERS[label] ?? getEditorWorker)();
}
