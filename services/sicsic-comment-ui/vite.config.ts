import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    manifest: true,
    rolldownOptions: {
      input: { frame: 'index.html', core: 'src/core.ts' },
      preserveEntrySignatures: 'exports-only',
    },
  },
});
