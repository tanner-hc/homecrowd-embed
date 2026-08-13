import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

var maplibreDist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/maplibre-gl/dist');
var maplibreWorkerFiles = {
  '/maplibre-gl-worker.mjs': path.join(maplibreDist, 'maplibre-gl-worker.mjs'),
  '/maplibre-gl-shared.mjs': path.join(maplibreDist, 'maplibre-gl-shared.mjs'),
};

function mapLibreWorkerPlugin() {
  return {
    name: 'maplibre-worker-static',
    configureServer(server) {
      server.middlewares.use(function (req, res, next) {
        var url = (req.url || '').split('?')[0];
        var file = maplibreWorkerFiles[url];
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      Object.keys(maplibreWorkerFiles).forEach(function (url) {
        this.emitFile({
          type: 'asset',
          fileName: url.slice(1),
          source: fs.readFileSync(maplibreWorkerFiles[url]),
        });
      }, this);
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  plugins: [
    // HTTPS only when asked for: `HTTPS=1 npm run dev`.
    //
    // http://localhost is already a secure context per spec, so geolocation and
    // workers work over plain http on this machine. TLS is only needed to reach
    // the dev server from another device over the LAN (server.host below), where
    // the origin is an IP and no longer counts as trustworthy.
    ...(process.env.HTTPS ? [basicSsl()] : []),
    mapLibreWorkerPlugin(),
    {
      name: 'hc-browser-log-to-terminal',
      configureServer(server) {
        server.middlewares.use(function hcBrowserLog(req, res, next) {
          if (req.url !== '/__hc_browser_log' || req.method !== 'POST') {
            return next();
          }
          var chunks = [];
          req.on('data', function (c) {
            chunks.push(c);
          });
          req.on('end', function () {
            try {
              var raw = Buffer.concat(chunks).toString('utf8');
              var j = JSON.parse(raw);
              var line = '[browser ' + (j.level || 'log') + '] ' + (Array.isArray(j.args) ? j.args.join(' ') : raw);
              console.log(line);
            } catch (e) {
              console.log('[browser] (parse error)', e && e.message);
            }
            res.statusCode = 204;
            res.end();
          });
        });
      },
    },
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
