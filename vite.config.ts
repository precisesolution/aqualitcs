import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' produces relative asset URLs so the build works at any subpath
// (Vercel root, GitHub Pages /aqualitcs/, Netlify, plain S3, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true, port: 5173 },
});
