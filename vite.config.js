import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: 'web',
  publicDir: 'assets',
  appType: 'spa',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web/js', import.meta.url)),
      '#css': fileURLToPath(new URL('./web/css', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // changeOrigin is intentionally false so the original Host header is
      // preserved — the API's CSRF check compares Origin against Host.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
        configure(proxy) {
          // Without this, an unreachable API surfaces as a bare
          // "Internal Server Error" with no hint about what went wrong.
          proxy.on('error', (error, request, response) => {
            if (!response || response.writableEnded || typeof response.writeHead !== 'function') return;
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(
              JSON.stringify({
                success: false,
                data: null,
                error: {
                  code: 'API_UNREACHABLE',
                  message:
                    'Cannot reach the JoyDM API on port 8080. Start it together with the web server using `npm run dev`.',
                },
              }),
            );
          });
        },
      },
    },
  },
});
