import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001', '/media': 'http://localhost:3001', '/videos': 'http://localhost:3001', '/movie-files': 'http://localhost:3001', '/covers': 'http://localhost:3001', '/songs': 'http://localhost:3001' } }
});

