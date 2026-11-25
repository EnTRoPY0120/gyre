import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

const VENDOR_CHUNK_RULES = [
	['monaco-editor', 'monaco-editor'],
	['@lucide/svelte', 'vendor-icons'],
	['bits-ui', 'vendor-ui'],
	['/svelte/', 'vendor-svelte'],
	['@sveltejs', 'vendor-svelte'],
	['drizzle-orm', 'vendor-db'],
	['yaml', 'vendor-yaml'],
	['js-yaml', 'vendor-yaml']
] as const;

const DOM_TEST_FILES = [
	'src/tests/focus-trap.test.ts',
	'src/tests/resource-row-click.test.ts',
	'src/tests/resource-table-links.test.ts',
	'src/tests/advanced-search-dom.test.ts',
	'src/tests/password-input.test.ts'
];

function getVendorChunk(id: string): string | null {
	if (!id.includes('node_modules')) return null;
	// Kit needs its client entry and runtime to retain their dynamic import boundary.
	if (id.includes('/@sveltejs/kit/')) return null;

	return VENDOR_CHUNK_RULES.find(([dependency]) => id.includes(dependency))?.[1] ?? 'vendor';
}

export default defineConfig(({ mode }) => {
	// Load .env vars and inject them into process.env so server-side code
	// that reads process.env directly (e.g. backup.ts, auth/crypto.ts) works
	// the same way in dev as it does in production/Kubernetes.
	const env = loadEnv(mode, process.cwd(), '');
	Object.assign(process.env, env);

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				adapter: adapter(),
				serviceWorker: { register: false },
				csp: {
					// Use nonce mode so SvelteKit injects per-request nonces into its inline
					// hydration scripts instead of relying on 'unsafe-inline'.
					mode: 'nonce',
					directives: {
						'default-src': ['self'],
						'script-src': ['self'], // SvelteKit appends 'nonce-<value>' automatically
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'blob:'],
						'font-src': ['self', 'data:'],
						'connect-src': ['self'],
						'worker-src': ['self'], // Monaco workers bundled locally, served from same origin
						'form-action': ['self'],
						'frame-ancestors': ['none'],
						'object-src': ['none'],
						'base-uri': ['self']
					}
				}
			})
		],
		test: {
			fileParallelism: false,
			isolate: true,
			projects: [
				{
					extends: true,
					test: {
						name: 'node',
						environment: 'node',
						include: ['src/tests/**/*.test.ts'],
						exclude: DOM_TEST_FILES
					}
				},
				{
					extends: true,
					resolve: { conditions: ['browser'] },
					test: { name: 'dom', environment: 'jsdom', include: DOM_TEST_FILES }
				}
			]
		},
		server: {
			fs: {
				// Allow Vite dev server to serve files from the project root so that
				// server-side modules (e.g. kubeconfig files, test fixtures) resolved
				// relative to process.cwd() are reachable during development.
				allow: ['.']
			}
		},
		optimizeDeps: {
			include: ['monaco-editor'],
			rolldownOptions: {
				// Ensure monaco-editor is fully tree-shaken during pre-bundling
				treeshake: true
			}
		},
		build: {
			sourcemap: false, // never emit .map files in production — avoids exposing source paths and pre-minified logic
			reportCompressedSize: true,
			// Monaco is intentionally lazy-loaded and emitted as its own large editor chunk.
			chunkSizeWarningLimit: 4300
		},
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							codeSplitting: { groups: [{ name: getVendorChunk }] }
						}
					}
				}
			}
		}
	};
});
