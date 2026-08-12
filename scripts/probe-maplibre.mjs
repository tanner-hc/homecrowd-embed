import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const URL_TO_OPEN = process.argv[2] || 'https://localhost:5173/maplibre-test.html';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--remote-allow-origins=*',
  '--ignore-certificate-errors',
  '--enable-unsafe-swiftshader',
  '--no-first-run',
  '--user-data-dir=/tmp/hc-probe-profile',
  'about:blank',
]);
chrome.stderr.on('data', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

async function main() {
  for (let i = 0; i < 40; i++) {
    try {
      await getJson('/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }

  const targets = await getJson('/json/list');
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));

  ws.addEventListener('open', () => {
    send('Runtime.enable');
    send('Log.enable');
    send('Page.enable');
    send('Page.navigate', { url: URL_TO_OPEN });
  });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || [])
        .map((a) => (a.value !== undefined ? a.value : a.description || a.type))
        .join(' ');
      console.log(`[${msg.params.type}] ${text}`);
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (e.level === 'error') console.log(`[log:${e.level}] ${e.text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.log(`[exception] ${d.text} ${d.exception ? d.exception.description : ''}`);
    }
  });

  await sleep(15000);
  ws.close();
  chrome.kill();
}

main().catch((e) => {
  console.error(e);
  chrome.kill();
  process.exit(1);
});
