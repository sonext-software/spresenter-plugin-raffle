import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Build da UI. Pequeno app React dentro de um iframe sandboxed. `base: './'`
// mantém as URLs relativas para o host servir em /plugins/<id>/ui/.
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/ui'),
    emptyOutDir: true,
  },
});
