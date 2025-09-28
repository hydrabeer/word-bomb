import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import sri from 'vite-plugin-sri';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Adds Subresource Integrity to built JS/CSS assets
    sri({ algorithms: ['sha384'] }),
  ],
  resolve: {
    alias: [
      {
        find: /^@game\/domain\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/domain/src/$1'),
      },
      {
        find: /^@word-bomb\/types\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/types/src/$1'),
      },
    ],
    dedupe: ['zod'],
  },
});
