// Exercise the real login page and countdown hook in an isolated browser.
// Auth and CAPTCHA are fixtures; no real login or external requests are made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { webpack } = require('next/dist/compiled/webpack/webpack');

const root = path.resolve(__dirname, '..');
const work = path.join(root, '.cache/admin-login-countdown');
const chrome = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(file => file && fs.existsSync(file));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('login shows 05:00 after failure five, persists on refresh, blocks resubmission and unlocks on expiry', { timeout: 60000 }, async () => {
  assert.ok(chrome, 'Install Chrome/Chromium or set CHROME_PATH to run the login UI test.');
  fs.mkdirSync(work, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(work, name), text);
  write('loader.cjs', `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
  write('image.jsx', `import React from 'react';export default props=><img {...props}/>;`);
  write('link.jsx', `import React from 'react';export default props=><a {...props}/>;`);
  write('transition.jsx', `export default ({children})=>children;`);
  write('navigation.js', `export const useRouter=()=>({push(){}});`);
  write('auth.js', `export async function loginAction(){window.loginCalls=(window.loginCalls||0)+1;return window.loginCalls>=5?{error:'Too many failed sign-in attempts.',retryAfterSeconds:300}:{error:'Unable to sign in. Check your username and password, then try again.'};}`);
  write('entry.jsx', `import React from 'react';import {createRoot} from 'react-dom/client';import Login from ${JSON.stringify(path.join(root,'app/admin/page.tsx').replaceAll('\\','/'))};
    window.loginCalls=0;window.turnstile={render(_el,options){window.verifyCaptcha=()=>options.callback('fixture-token');window.verifyCaptcha();return 'widget';},reset(){},remove(){}};
    const append=document.head.appendChild.bind(document.head);document.head.appendChild=function(node){if(node.tagName==='SCRIPT'&&node.src.includes('challenges.cloudflare.com')){setTimeout(()=>node.onload(),0);return node;}return append(node);};
    createRoot(document.getElementById('app')).render(<Login/>);`);
  await new Promise((resolve, reject) => webpack({
    mode: 'development', context: root, entry: path.join(work, 'entry.jsx'), devtool: false,
    output: { path: work, filename: 'bundle.js' },
    plugins: [new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY': JSON.stringify('fixture-site-key') })],
    resolve: { extensions: ['.tsx','.ts','.jsx','.js'], alias: {
      'next/image': path.join(work,'image.jsx'), 'next/link': path.join(work,'link.jsx'),
      'next/navigation': path.join(work,'navigation.js'),
      '@/app/components/page-transitions': path.join(work,'transition.jsx'),
      '@/app/actions/auth': path.join(work,'auth.js'),
    } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(work,'loader.cjs') }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all:false, errors:true }))) : resolve()));

  const server = http.createServer((req,res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type','application/javascript'); fs.createReadStream(path.join(work,'bundle.js')).pipe(res); }
    else { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><body><div id="app"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = spawn(chrome, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--remote-debugging-port=0',`--user-data-dir=${path.join(work,`profile-${process.pid}`)}`,'about:blank'],
    { windowsHide:true, stdio:['ignore','ignore','pipe'] });
  let socket;
  try {
    const url = await new Promise((resolve,reject) => {
      let output=''; const timeout=setTimeout(()=>reject(new Error('Browser startup timed out')),15000);
      browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
      browser.on('error',error=>{clearTimeout(timeout);reject(error);});
      browser.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Browser exited ${code}: ${output.slice(-300)}`));});
    });
    socket = new WebSocket(url);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let id=0;const pending=new Map();const exceptions=[];
    socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);if(msg.id){const task=pending.get(msg.id);pending.delete(msg.id);if(task)msg.error?task.reject(new Error(JSON.stringify(msg.error))):task.resolve(msg.result);}};
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>reject(new Error(`CDP timeout: ${method}`)),10000);pending.set(key,{resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}});socket.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}));});
    const target=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await send('Runtime.enable',{},sessionId);
    await send('Page.enable',{},sessionId);
    const evaluate=async expression=>{
      const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
      if(response.exceptionDetails)throw new Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
      return response.result.value;
    };
    const until=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await pause(50);}throw new Error(`Timed out waiting for ${expression}`);};
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`},sessionId);
    await until('Boolean(document.querySelector("#username") && window.verifyCaptcha)');
    const fill=`for(const [id,value] of [['username','admin'],['password','wrong-password']]){const input=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}window.verifyCaptcha();`;
    await evaluate(fill);
    for(let attempt=1;attempt<=5;attempt++){
      await evaluate('window.verifyCaptcha()');
      await until('!document.querySelector("button[type=submit]").disabled');
      await evaluate('document.querySelector("form").requestSubmit()');
      await until(`window.loginCalls===${attempt} && !document.querySelector('button[type=submit]').textContent.includes('Authenticating')`);
      if(attempt<5)assert.equal(await evaluate('document.querySelector("button[type=submit]").textContent'),'Sign In');
    }
    assert.equal(await evaluate('document.querySelector("button[type=submit]").textContent'),'Try again in 05:00');
    assert.equal(await evaluate('document.body.textContent.includes("Sign-in temporarily paused")'),false);
    assert.equal(await evaluate('document.querySelector("button[type=submit]").disabled'),true);
    assert.deepEqual(await evaluate('["username","password"].map(id=>document.getElementById(id).disabled)'),[true,true]);
    await evaluate('document.querySelector("form").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
    assert.equal(await evaluate('window.loginCalls'),5);
    // Simulate elapsed wall time without a five-minute test delay. A focus event
    // also verifies recovery from background-tab timer throttling.
    await evaluate('window.originalNow=Date.now;Date.now=()=>window.originalNow()+2000;window.dispatchEvent(new Event("focus"))');
    await until('document.querySelector("button[type=submit]").textContent <= "Try again in 04:58"');
    await send('Page.reload',{},sessionId);
    await until('Boolean(window.verifyCaptcha && document.querySelector("button[type=submit]")?.textContent.startsWith("Try again in "))');
    const restored=await evaluate('document.querySelector("button[type=submit]").textContent');
    assert.match(restored,/^Try again in 0[45]:[0-5]\d$/);
    assert.equal(await evaluate('document.querySelector("button[type=submit]").disabled'),true);
    assert.deepEqual(await evaluate('["username","password"].map(id=>document.getElementById(id).disabled)'),[true,true]);
    await evaluate('window.savedDeadline=Number(sessionStorage.getItem("admin-login-retry-until"));window.originalNow=Date.now;Date.now=()=>window.savedDeadline-1000;window.dispatchEvent(new Event("focus"))');
    await until('document.querySelector("button[type=submit]").textContent === "Try again in 00:01"');
    await evaluate('Date.now=()=>window.savedDeadline+1;window.dispatchEvent(new Event("focus"))');
    await until('document.querySelector("button[type=submit]").textContent === "Sign In"');
    assert.deepEqual(await evaluate('["username","password"].map(id=>document.getElementById(id).disabled)'),[false,false]);
    assert.equal(await evaluate('sessionStorage.getItem("admin-login-retry-until")'),null);
    await evaluate(fill);
    await until('!document.querySelector("button[type=submit]").disabled');
    assert.equal(await evaluate('document.querySelector("button[type=submit]").textContent'),'Sign In');
    assert.deepEqual(exceptions,[]);
  } finally {
    if(socket)socket.close();
    browser.kill();
    await new Promise(resolve=>server.close(resolve));
  }
});
