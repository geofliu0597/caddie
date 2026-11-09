import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works from any static host path
export default defineConfig({
  base: './',
  plugins: [react()],
});
