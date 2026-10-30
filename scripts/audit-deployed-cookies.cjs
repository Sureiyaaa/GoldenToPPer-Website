// Read-only browser audit. Cookie values, credentials, form values, and tokens
// are intentionally omitted from both stdout and the saved report.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const baseUrl = new URL(process.argv[2] || 'https://goldentopper.vercel.app');
if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new Error('Provide a public HTTP(S) origin without credentials.');
const output = path.resolve(process.argv[3] || '.next/cookie-audit.json');
const executable = process.env.COOKIE_AUDIT_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));
if (!executable) throw new Error('Set COOKIE_AUDIT_BROWSER to a Chrome/Edge executable.');
const profile = path.resolve('.next', 'deployed-cookie-audit-' + Date.now());
const browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-gpu', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
const pending = new Map();
const requestOrigins = new Map();
let socket, sequence = 0, phase;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error('Page inspection failed.');
  return result.result.value;
}
function metadata(cookie) {
  return { name: cookie.name, domain: cookie.domain, path: cookie.path, session: cookie.session, expires: cookie.expires > 0 ? new Date(cookie.expires * 1000).toISOString() : null, secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite || 'Unspecified', partitioned: Boolean(cookie.partitionKey) };
}
function responseCookie(line, origin, blockedReasons = []) {
  const [pair, ...attributes] = line.split(';');
  const fields = Object.fromEntries(attributes.map(part => {
    const [key, ...value] = part.trim().split('=');
    return [key.toLowerCase(), value.join('=') || true];
  }));
  return { name: pair.split('=')[0].trim(), responseOrigin: origin || 'Unknown', domain: fields.domain || (origin ? new URL(origin).hostname : 'Unknown'), path: fields.path || '/', expires: fields.expires || null, maxAge: fields['max-age'] || null, secure: Boolean(fields.secure), httpOnly: Boolean(fields.httponly), sameSite: fields.samesite || 'Unspecified', blockedReasons };
}
async function inspect(route, label = route, optionalChoice) {
  phase = { label, route, responseCookieNames: [], responseCookies: [], resourceOrigins: [], blockedSitePosts: 0 };
  const current = phase;
  await send('Page.navigate', { url: new URL(route, baseUrl).href });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await evaluate(`document.readyState === 'complete'`)) break;
    await pause(250);
  }
  await pause(2500);
  if (optionalChoice !== undefined) {
    current.choiceAttempted = optionalChoice;
    current.settingsFound = await evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Cookie settings'); if(!b)return false;b.click();return true})()`);
    if (current.settingsFound) {
      await pause(200);
      current.choiceSaved = await evaluate(`(() => {const d=document.querySelector('dialog[open]');if(!d)return false;const checkbox=d.querySelector('input[type=checkbox]');if(!checkbox)return false;if(checkbox.checked!==${optionalChoice})checkbox.click();const b=[...d.querySelectorAll('button')].find(el=>el.textContent.trim()==='Accept selected cookies');if(!b)return false;b.click();return true})()`);
      await pause(1200);
    }
  }
  await evaluate(`window.scrollTo(0,document.body.scrollHeight/2)`);
  await pause(1200);
  current.page = await evaluate(`({url:location.origin+location.pathname,title:document.title,settingsButtons:[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Cookie settings').length,turnstileScripts:[...document.scripts].filter(s=>s.src.startsWith('https://challenges.cloudflare.com/')).length,turnstileFrames:[...document.querySelectorAll('iframe')].filter(f=>f.src.startsWith('https://challenges.cloudflare.com/')).length,mediaFrames:[...document.querySelectorAll('iframe')].filter(f=>/youtube/.test(f.src)).length,localStorageKeys:Object.keys(localStorage),sessionStorageKeys:Object.keys(sessionStorage)})`);
  current.cookies = (await send('Storage.getCookies')).cookies.map(metadata);
  current.responseCookieNames = [...new Set(current.responseCookieNames)];
  current.resourceOrigins = [...new Set(current.resourceOrigins)];
  return current;
}
(async () => {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Headless browser startup timed out.')), 20000);
    browser.stderr.on('data', data => { const match = String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    browser.once('error', error => { clearTimeout(timeout); reject(error); });
    browser.once('exit', code => { clearTimeout(timeout); reject(new Error('Browser exited before startup: ' + code)); });
  });
  const port = new URL(endpoint).port;
  const targets = await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json());
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      clearTimeout(entry.timeout); pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const isSiteWrite = new URL(request.url).origin === baseUrl.origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      if (isSiteWrite && phase) phase.blockedSitePosts++;
      send(isSiteWrite ? 'Fetch.failRequest' : 'Fetch.continueRequest', isSiteWrite ? { requestId, errorReason: 'Aborted' } : { requestId }).catch(() => {});
    } else if (message.method === 'Network.responseReceivedExtraInfo' && phase) {
      const origin = requestOrigins.get(message.params.requestId);
      for (const [key, value] of Object.entries(message.params.headers)) {
        if (key.toLowerCase() === 'set-cookie') for (const line of String(value).split('\n')) {
          phase.responseCookieNames.push(line.split('=')[0].trim());
          const blocked = (message.params.blockedCookies || []).find(cookie => cookie.cookieLine === line);
          phase.responseCookies.push(responseCookie(line, origin, blocked?.blockedReasons || []));
        }
      }
    } else if (message.method === 'Network.requestWillBeSent' && phase) {
      try { const url = new URL(message.params.request.url); if (['http:', 'https:'].includes(url.protocol)) { phase.resourceOrigins.push(url.origin); requestOrigins.set(message.params.requestId, url.origin); } } catch {}
    }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.clearBrowserCookies');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('submit',event=>event.preventDefault(),true);` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  const report = { checkedAt: new Date().toISOString(), origin: baseUrl.origin, browser: (await send('Browser.getVersion')).product, mode: 'Fresh isolated profile; all site POSTs (including read-only server actions) blocked; no login, CAPTCHA solving, payment or form submission.', phases: [] };
  for (const route of ['/', '/projects', '/payment', '/partnerbanks', '/contact', '/inquire', '/admin', '/cookie-notice']) {
    report.phases.push(await inspect(route));
    console.log('Inspected ' + route);
  }
  report.phases.push(await inspect('/', 'Necessary-only choice', false));
  report.phases.push(await inspect('/', 'Optional media choice', true));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    checkedAt: report.checkedAt, origin: report.origin, browser: report.browser,
    report: output,
    phases: report.phases.map(item => ({
      label: item.label, responseCookieNames: item.responseCookieNames,
      storedCookieNames: item.cookies.map(cookie => cookie.name),
      turnstileScripts: item.page.turnstileScripts,
      settingsFound: item.page.settingsButtons > 0,
      blockedSitePosts: item.blockedSitePosts,
    })),
  }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  browser.kill();
});
