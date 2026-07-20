import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build da thread de lógica. Gera um único IIFE (sem DOM) que o host avalia
// dentro do vm restrito, onde o global `spresenter` é injetado.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // preserva dist/ui do outro build
    lib: {
      entry: resolve(__dirname, 'src/code.ts'),
      formats: ['iife'],
      name: 'SpresenterPlugin',
      fileName: () => 'code.js',
    },
    target: 'es2020',
    minify: false,
  },
});
