// Browser geometry checks use the real component/provider and Tailwind styles,
// with local notification fixtures. No application route or customer data is changed.
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const ts = require('typescript');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { webpack } = require('next/dist/compiled/webpack/webpack');

const root = path.resolve(__dirname, '..');
const work = path.join(root, '.cache/inbox-scroll');
const baseline = process.argv.includes('--baseline');
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(candidate => candidate && fs.existsSync(candidate));

async function prepare() {
  fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(work, 'ts-loader.cjs'), `const ts = require('typescript'); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText; };`);
  fs.writeFileSync(path.join(work, 'navigation.js'), `export const useRouter = () => ({push() {}});`);
  fs.writeFileSync(path.join(work, 'supabase.js'), `export const createClient = () => ({ channel: () => ({ on() { return this; }, subscribe(callback) { window.inboxLiveStatus = callback; return this; } }), removeChannel() {} });`);
  fs.writeFileSync(path.join(work, 'actions.js'), `export async function fetchNotificationsAction() { if (window.inboxFetchError) throw new Error('Fixture fetch failure'); return window.inboxItems; } export async function toggleNotificationReadAction() {}`);
  const dashboard = fs.readFileSync(path.join(root, 'app/admin/dashboard/page.tsx'), 'utf8');
  const contentClass = dashboard.match(/<div className=\{\x60(min-h-0 flex-1 \[scrollbar-gutter:stable\][^\x60]+)\x60\}>/)[1];
  fs.writeFileSync(path.join(work, 'entry.jsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { CustomerInboxProvider, CustomerInboxManager } from '../../app/admin/components/customer-inbox';
    window.inboxItems = [];
    window.setInboxItems = async (items) => {
      window.inboxItems = items;
      window.dispatchEvent(new Event('focus'));
      await new Promise(resolve => setTimeout(resolve, 80));
    };
    const activeTab = 'Customer Inbox';
    createRoot(document.getElementById('app')).render(
      <CustomerInboxProvider enabled={true}>
        <div className="flex h-screen bg-[#F8F9FA] text-gray-900 font-sans overflow-hidden relative">
          <aside className="fixed inset-y-0 left-0 hidden w-20 bg-brand-blue md:block" aria-label="Dashboard navigation" />
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden md:ml-20">
            <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 shadow-sm"><h1 className="text-2xl md:text-3xl font-serif text-brand-blue truncate">Customer Inbox</h1></header>
            <div data-dashboard-content className={\x60${contentClass}\x60}><CustomerInboxManager /></div>
          </main>
        </div>
      </CustomerInboxProvider>
    );
  `);
  await new Promise((resolve, reject) => webpack({
    mode: 'development', context: root, entry: path.join(work, 'entry.jsx'),
    devtool: false, output: { path: work, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: {
      '@/utils/supabase/client': path.join(work, 'supabase.js'),
      '@/app/actions/admin_fetchers': path.join(work, 'actions.js'),
      'next/navigation': path.join(work, 'navigation.js'), '@': root,
    } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(work, 'ts-loader.cjs') }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  fs.writeFileSync(path.join(work, 'styles.css'), css.css);
  const fontDirectory = path.join(root, '.next/static/chunks');
  const fontFiles = fs.existsSync(fontDirectory) ? fs.readdirSync(fontDirectory).filter(file => file.endsWith('.css') && fs.readFileSync(path.join(fontDirectory, file), 'utf8').includes('--font-poppins')) : [];
  fs.writeFileSync(path.join(work, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontFiles.map(file => `<link rel="stylesheet" href="/_next/static/chunks/${file}">`).join('')}<link rel="stylesheet" href="/styles.css"></head><body class="font-sans antialiased"><div id="app"></div><script src="/bundle.js"></script></body></html>`);
}

function fixtures(count, long = false) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1, name: long && index === 0 ? 'A very long customer name that must remain within the sender column without increasing the records row height' : `Customer ${index + 1}`,
    client_email: long && index === 0 ? 'a-very-long-customer-email-address-that-would-otherwise-wrap@example.com' : `customer${index + 1}@example.com`,
    client_phone: '09171234567', title: 'Property inquiry', created_at: '2026-10-05T08:00:00Z',
    is_read: index % 2 === 1, can_mark_read: true,
    ...(index % 3 === 0 ? { type: 'inquiry', project_name: long && index === 0 ? 'A very long project name that would otherwise wrap onto many lines and change the height of the row' : 'City Clou' }
      : index % 3 === 1 ? { type: 'loan_application', project_name: 'Park One', bank_name: 'BDO', tower: 'A', unit_no: 12, floor_no: 3, co_buyer_name: null, is_agreed: true }
        : { type: 'customer_support', title: 'Payment & billing', message: 'Please help with my receipt.' }),
  }));
}

async function main() {
  await prepare();
  console.log('Compiled the real inbox component and Tailwind CSS.');
  const server = http.createServer((req, res) => {
    const relative = req.url.startsWith('/_next/') ? req.url.replace('/_next/', '.next/') : `.cache/inbox-scroll/${req.url === '/' ? 'index.html' : req.url.slice(1)}`;
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.woff2') ? 'font/woff2' : 'text/html');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${path.join(work, 'chrome-profile')}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const browserUrl = await new Promise((resolve, reject) => {
      let stderr = '';
      const timer = setTimeout(() => reject(new Error('Chrome debugging startup timeout')), 15000);
      browser.stderr.on('data', data => { stderr += data; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
      browser.on('error', reject);
      browser.on('exit', code => reject(new Error(`Chrome exited: ${code} ${stderr.slice(-200)}`)));
    });

    socket = new WebSocket(browserUrl);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('WebSocket startup timeout')), 10000); socket.onopen = () => { clearTimeout(timer); resolve(); }; socket.onerror = error => { clearTimeout(timer); reject(error); }; });

    let id = 0; const pending = new Map(); const exceptions = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text + ' ' + (message.params.exceptionDetails.exception?.description || ''));
      if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000); pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const size = async (width, height) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await wait(150); };
    await call('Runtime.enable');
    await size(1440, 900);
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    console.log('Navigated to isolated local fixture.');
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(`typeof window.setInboxItems === 'function' && !!document.querySelector('#customer-inbox-title')`)) break; await wait(100); }
    await evaluate(`document.fonts.ready`);
    // Use the emitted Poppins family name, which includes the build-specific hash.
    const fontFamily = await evaluate(`Array.from(document.styleSheets).flatMap(sheet => { try { return Array.from(sheet.cssRules); } catch { return []; } }).filter(rule => rule.type === CSSRule.FONT_FACE_RULE && rule.style.fontFamily.includes('Poppins')).map(rule => rule.style.fontFamily)[0]`);
    if (fontFamily) await evaluate(`document.body.style.setProperty('--font-poppins', ${JSON.stringify(fontFamily)}); document.fonts.ready`);
    const setItems = items => evaluate(`window.setInboxItems(${JSON.stringify(items)})`);
    const inspect = () => evaluate(`(() => {
      const section = document.querySelector('section[aria-labelledby="customer-inbox-title"]');
      const table = section.querySelector('table');
      const rows = [...table.querySelectorAll('tbody tr')];
      const viewport = table.parentElement;
      const head = table.querySelector('thead');
      const content = document.querySelector('[data-dashboard-content]');
      const rect = element => { const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return { y: r.y, bottom: r.bottom, height: r.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop, heightCSS: s.height, maxHeight: s.maxHeight, minHeight: s.minHeight, flex: s.flex, overflow: s.overflow, font: s.fontFamily }; };
      const boundary = viewport.getBoundingClientRect();
      const desktop = getComputedStyle(table).display !== 'none';
      const headerBottom = desktop ? head.getBoundingClientRect().bottom : boundary.top;
      const recordRows = desktop ? rows : [...viewport.querySelectorAll('li')];
      return { section: rect(section), card: rect(viewport.parentElement), viewport: rect(viewport), table: rect(table), head: rect(head), rows: rows.map(rect), visibleRows: recordRows.filter(row => row.getBoundingClientRect().top >= headerBottom - 0.1 && row.getBoundingClientRect().bottom <= boundary.bottom + 0.1).length, content: rect(content), bodyScroll: document.documentElement.scrollHeight - innerHeight, wheelX: boundary.x + boundary.width/2, wheelY: headerBottom + 40 };
    })()`);
    if (baseline) {
      await setItems(fixtures(7));
      const metrics = await inspect();
      fs.writeFileSync(path.join(work, 'baseline.json'), JSON.stringify(metrics, null, 2));
      console.log(JSON.stringify({ baseline: metrics }));
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(work, 'before.png'), Buffer.from(screenshot.data, 'base64'));
      return;
    }
    const reports = [];
    const assertNear = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 0.1, `${message}: ${actual} versus ${expected}`);
    const scroll = top => evaluate(`document.querySelector('[aria-label="Customer message records"]').scrollTop = ${top}`);
    const change = async (kind, value) => {
      await evaluate(`(() => {
        const control = document.querySelector(${JSON.stringify(kind === 'search' ? 'input[type="search"]' : kind === 'type' ? 'select:first-of-type' : 'select:last-of-type')});
        const element = ${JSON.stringify(kind)} === 'read' ? [...document.querySelectorAll('select')][1] : control;
        const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
        element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
      })()`);
      await wait(100);
    };
    for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 20, 50]) {
      await setItems(fixtures(count));
      assert.equal(await evaluate(`(() => { const section = document.querySelector('section[aria-labelledby="customer-inbox-title"]'); const counters = section.querySelector('[aria-live="polite"]').textContent; return counters.includes('${count} Total records') && counters.includes('${Math.ceil(count / 2)} Unread') && section.lastElementChild.matches('[aria-busy]') && !section.textContent.includes('Showing '); })()`), true, 'Only top total/unread counters remain; records card ends the Inbox');
      if (!count) {
        assert.equal(await evaluate(`document.querySelector('section').textContent.includes('No customer messages yet')`), true);
        reports.push({ count, empty: true });
        continue;
      }
      const metrics = await inspect();
      assertNear(metrics.viewport.height, 408, `${count} records viewport height`);
      assertNear(metrics.head.height, 48, 'Header height');
      metrics.rows.forEach(row => assertNear(row.height, 72, 'Row height'));
      assert.equal(metrics.visibleRows, Math.min(5, count), `${count} records complete visible rows`);
      assert.equal(metrics.viewport.scrollHeight > metrics.viewport.clientHeight, count > 5, `${count} records scroll requirement`);
      assert.ok(metrics.card.bottom <= metrics.content.bottom, 'Records card fits dashboard');
      assert.equal(metrics.content.scrollHeight, metrics.content.clientHeight, 'No dashboard overflow');
      assert.equal(metrics.bodyScroll, 0, 'No page overflow');
      assert.equal(await evaluate(`(() => { const region = document.querySelector('[aria-label="Customer message records"]'); const style = getComputedStyle(region); return style.overflowY === 'auto' && style.overscrollBehaviorY === 'contain' && style.scrollbarWidth === 'none' && getComputedStyle(region, '::-webkit-scrollbar').display === 'none' && region.scrollWidth === region.clientWidth; })()`), true, 'Usable hidden scrollbar without horizontal overflow');
      if (count > 5) {
        assertNear(metrics.rows[5].y, metrics.viewport.bottom, 'Sixth row begins beyond viewport');
        await scroll(99999);
        const end = await inspect();
        assertNear(end.rows[count - 1].bottom, end.viewport.bottom, 'Last row reachable internally');
        assertNear(end.head.y, metrics.head.y, 'Header remains sticky');
        assertNear(end.card.y, metrics.card.y, 'Records card remains stationary');
      }
      reports.push({ count, height: metrics.viewport.height, rowHeight: metrics.rows[0].height, visibleRows: metrics.visibleRows, scrollHeight: metrics.viewport.scrollHeight });
    }
    await setItems(fixtures(20, true));
    let metrics = await inspect();
    metrics.rows.forEach(row => assertNear(row.height, 72, 'Long content preserves row height'));
    assert.equal(metrics.visibleRows, 5, 'Long content preserves five rows');
    await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: metrics.wheelX, y: metrics.wheelY, deltaX: 0, deltaY: 180 });
    await wait(200);
    metrics = await inspect();
    assert.ok(metrics.viewport.scrollTop > 0, 'Mouse wheel scrolls records');
    assert.equal(metrics.content.scrollTop, 0, 'Mouse wheel does not scroll dashboard');
    await scroll(0);
    for (let step = 0; step < 4; step++) await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: metrics.wheelX, y: metrics.wheelY, deltaX: 0, deltaY: 12 });
    await wait(200);
    assert.ok((await inspect()).viewport.scrollTop > 0, 'Small trackpad-like wheel deltas scroll records');
    await scroll(0);
    await evaluate(`document.querySelector('[aria-label="Customer message records"]').focus()`);
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
    await wait(300);
    assert.ok((await inspect()).viewport.scrollTop > 0, 'Keyboard PageDown scrolls focusable region');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    await wait(300);
    metrics = await inspect();
    assertNear(metrics.rows[19].bottom, metrics.viewport.bottom, 'Keyboard End reaches last row');
    await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: metrics.wheelX, y: metrics.wheelY, deltaX: 0, deltaY: 180 });
    await wait(200);
    assert.equal((await inspect()).content.scrollTop, 0, 'Wheel at records boundary does not chain to dashboard');
    await scroll(0);
    await evaluate(`document.querySelector('tbody tr:nth-child(5) button').focus()`);
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await wait(150);
    assert.equal(await evaluate(`document.activeElement === document.querySelector('tbody tr:nth-child(6) button')`), true, 'Tab reaches offscreen Open button');
    assert.equal(await evaluate(`(() => { const active = document.activeElement.getBoundingClientRect(); const header = document.querySelector('thead').getBoundingClientRect(); const viewport = document.querySelector('[aria-label="Customer message records"]').getBoundingClientRect(); return active.top >= header.bottom && active.bottom <= viewport.bottom; })()`), true, 'Focused Open button is visible below sticky header');
    await setItems(fixtures(20));
    await scroll(250);
    await change('search', 'Customer');
    assert.equal((await inspect()).viewport.scrollTop, 0, 'Search resets internal scroll');
    await scroll(150);
    await change('type', 'loan_application');
    assert.equal((await inspect()).viewport.scrollTop, 0, 'Type resets internal scroll');
    await change('type', 'all');
    await scroll(150);
    await change('read', 'unread');
    assert.equal((await inspect()).viewport.scrollTop, 0, 'Read filter resets internal scroll');
    await change('read', 'all');
    await change('search', 'no matching customer');
    assert.equal(await evaluate(`document.querySelector('section').textContent.includes('No matching messages')`), true, 'No-match state');
    await change('search', '');
    await scroll(200);
    await setItems(fixtures(20));
    assert.equal((await inspect()).viewport.scrollTop, 200, 'Identical refresh preserves scroll');
    const changed = fixtures(20); changed[0].project_name = 'A changed project';
    await setItems(changed);
    assert.equal((await inspect()).viewport.scrollTop, 0, 'Material content change with same count resets scroll');
    await scroll(200);
    await setItems(fixtures(21));
    assert.equal((await inspect()).viewport.scrollTop, 0, 'Inserted record resets scroll');
    await setItems(fixtures(7));
    for (const [width, height] of [[1024, 768], [1366, 768], [1440, 900], [1920, 1080], [1366, 600], [768, 1024], [375, 667], [375, 400]]) {
      await size(width, height);
      await scroll(0);
      const view = await inspect();
      console.log(JSON.stringify({ width, height, viewport: view.viewport.height, visibleRows: view.visibleRows, cardBottom: view.card.bottom, contentBottom: view.content.bottom, contentHeight: view.content.clientHeight, contentScrollHeight: view.content.scrollHeight, sectionScrollHeight: view.section.scrollHeight }));
      if (width >= 1024 && height >= 768) {
        assertNear(view.viewport.height, 408, 'Desktop viewport');
        assert.equal(view.visibleRows, 5, 'Desktop visible rows');
        assert.ok(view.card.bottom <= view.content.bottom, `Records card fits ${width}x${height}`);
        assert.equal(view.content.scrollHeight, view.content.clientHeight, 'Desktop dashboard does not scroll');
        const longItems = fixtures(7, true); longItems[0].can_mark_read = false;
        await setItems(longItems);
        const longView = await inspect();
        longView.rows.forEach(row => assertNear(row.height, 72, 'Long content/untracked status at desktop width'));
        assert.equal(longView.visibleRows, 5, 'Long content retains five visible rows at desktop width');
        await setItems(fixtures(7));
      } else {
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-dashboard-content]')).overflowY`), 'auto', 'Accessible outer scrolling');
        assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'No horizontal page overflow');
        if (width < 1024) assert.ok(view.viewport.height <= Math.min(448, height * .6) + .1, 'Mobile bounded card viewport');
        await evaluate(`document.querySelector('[data-dashboard-content]').scrollTop = 99999`);
        assert.ok((await inspect()).card.bottom <= height, 'Records card accessible by outer scroll');
      }
      const screenshot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(work, `after-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
      reports.push({ width, height, viewport: view.viewport.height, cardBottom: view.card.bottom, outerScrollNeeded: view.content.scrollHeight > view.content.clientHeight });
    }
    await size(375, 667);
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await evaluate(`document.querySelector('[data-dashboard-content]').scrollTop = 180`);
    await scroll(0);
    const touchPoint = await evaluate(`(() => { const r = document.querySelector('[aria-label="Customer message records"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(r.bottom, innerHeight) - 40 }; })()`);
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touchPoint, id: 0 }] });
    for (let step = 1; step <= 5; step++) {
      await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchPoint.x, y: touchPoint.y - step * 30, id: 0 }] });
      await wait(40);
    }
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(300);
    assert.ok((await inspect()).viewport.scrollTop > 0, 'Touch swipe scrolls mobile cards');
    await size(1024, 768);
    await evaluate(`window.inboxLiveStatus('CHANNEL_ERROR')`);
    await wait(100);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-dashboard-content]')).overflowY`), 'auto', 'Live-update notice permits accessible outer scrolling');
    await evaluate(`document.querySelector('[data-dashboard-content]').scrollTop = 99999`);
    assert.ok((await inspect()).card.bottom <= 768, 'Records card remains accessible with live-update notice');
    await evaluate(`window.inboxLiveStatus('SUBSCRIBED'); window.inboxFetchError = true; window.dispatchEvent(new Event('focus'))`);
    await wait(100);
    assert.equal(await evaluate(`!!document.querySelector('[data-inbox-notice] [role="alert"]')`), true, 'Refresh failure retains records and shows existing error state');
    await evaluate(`document.querySelector('[data-dashboard-content]').scrollTop = 99999`);
    assert.ok((await inspect()).card.bottom <= 768, 'Records card remains accessible with error notice');
    assert.equal(exceptions.length, 0, `Browser exceptions: ${exceptions.join('; ')}`);
    fs.writeFileSync(path.join(work, 'results.json'), JSON.stringify(reports, null, 2));
    console.log('PASS: counts 0/1/2/3/4/5/6/7/20/50, top counters without footer, long content, sticky header, wheel, trackpad-style deltas, keyboard, touch, filter resets, material refresh resets, responsive layouts.');
  } finally {
    if (socket) socket.close();
    browser.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
test('Customer Inbox has five desktop rows, accessible scrolling, and stable filter/refresh boundaries', { skip: chrome ? false : 'Set CHROME_PATH to a Chromium executable to run browser layout checks.' }, main);
