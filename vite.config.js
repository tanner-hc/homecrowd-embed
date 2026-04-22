import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  plugins: [
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
