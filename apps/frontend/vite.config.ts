import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sri from 'vite-plugin-sri';

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Adds Subresource Integrity to built JS/CSS assets
    sri({ algorithms: ['sha384'] }),
  ],
  resolve: {
    alias: {
      '@game/domain': resolve(__dirname, '../../packages/domain/src'),
    },
    dedupe: ['zod'],
  },
});
