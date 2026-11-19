import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Loaded without the VITE_ prefix filter so non-client vars (API_PROXY_TARGET)
  // are readable here too - the proxy target is a dev-server concern, never
  // shipped to the browser.
  const env = loadEnv(mode, process.cwd(), '');

  // Shared by the dev and preview servers so a relative VITE_API_BASE_URL works
  // in both, and in neither case does the browser make a cross-origin request.
  const proxy = {
    '/backend': {
      // Point at wherever this machine serves the API. Default is XAMPP on :80.
      // In this monolith the PHP API lives in backend/ inside the same repo and
      // is served by Apache, e.g. http://localhost/PowerGuides/backend.
      target: env.API_PROXY_TARGET || 'http://localhost',
      // Rewrite Host to the target's, so Apache matches its virtual host even
      // when the browser reached the dev server through a LAN IP.
      changeOrigin: true,
      secure: false,
      // The repo lives inside a `PowerGuidesDagupan` folder under htdocs, so
      // Apache serves the API at /PowerGuidesDagupan/backend. Rewrite the
      // proxied path so /backend/api/... reaches /PowerGuidesDagupan/backend/api/... on Apache.
      rewrite: (path) => path.replace(/^\/backend/, '/PowerGuidesDagupan/backend'),
    },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    server: {
      // PINNED, and strictPort so Vite refuses to start rather than silently moving.
      //
      // This is not cosmetic: the Google OAuth return trip is hardcoded on the server
      // side (`FRONTEND_URL=http://localhost:5174` in backend/.env, read by
      // google_callback.php). With strictPort:false, Vite would fall back to 5175+ if
      // 5174 was busy, and Google would sign the user in and then redirect them to an
      // origin that is not the app they started from - the round trip just dies.
      port: 5174,
      strictPort: true,
      // Same-origin API calls. With VITE_API_BASE_URL=/backend the browser
      // never makes a cross-origin request, so the API's Access-Control-Allow-Origin
      // allow-list (backend/config/cors.php) is not consulted at all. That is
      // what makes this work unchanged on any device: a LAN origin such as
      // http://192.168.1.20:5174 would not be in the API's hardcoded localhost list,
      // but the proxy makes that irrelevant.
      proxy,
      // SPA fallback for the dev server: client-side routes such as /register
      // have no physical file, so Vite would 404 on them. Serve index.html and
      // let react-router render the matching page instead. API proxy (/backend),
      // Vite internals (/@fs, /@vite) and static assets pass through unchanged.
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (
            req.url.startsWith('/backend') ||
            req.url.startsWith('/@fs') ||
            req.url.startsWith('/@vite') ||
            req.url.includes('.')
          ) {
            return next();
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(fs.createReadStream(path.resolve(process.cwd(), 'index.html')));
        });
      },
    },
    // Same proxy for `npm run preview`, so the built app behaves like the dev one.
    preview: { proxy },
    build: {
      rollupOptions: {
        output: {
          // Keep the vendor libraries in their own chunks so app updates stay small.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            maps: ['leaflet', 'react-leaflet'],
            charts: ['recharts'],
          },
        },
      },
    },
  };
});
