import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		include: ['monaco-editor']
	},
	build: {
		reportCompressedSize: true,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('monaco-editor')) return 'monaco-editor';
						if (id.includes('lucide-svelte')) return 'vendor-icons';
						if (id.includes('drizzle-orm')) return 'vendor-db';
						return 'vendor';
					}
				}
			}
		}
	},
	ssr: {
		noExternal: ['@xyflow/svelte']
	}
});
