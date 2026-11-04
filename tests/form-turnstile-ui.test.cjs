const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname,'..');
const work = path.join(root,'.cache/form-turnstile-ui');
const chrome = [process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(file=>file&&fs.existsSync(file));
const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('shared Turnstile isolates form tokens, handles expiry/retries/remounts and fails closed on script errors', {timeout:60000}, async()=>{
  assert.ok(chrome,'Install Chrome/Chromium or set CHROME_PATH.');
  fs.mkdirSync(work,{recursive:true});
  fs.writeFileSync(path.join(work,'loader.cjs'),`const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
  fs.writeFileSync(path.join(work,'entry.jsx'),`
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {FormTurnstile,useFormTurnstile} from ${JSON.stringify(path.join(root,'app/components/form-turnstile.tsx').replaceAll('\\','/'))};
    window.widgets=new Map();window.removed=[];window.resets=[];window.scriptsAdded=0;window.controllers={};let nextId=0;
    const sdk={render(_element,options){const id=String(++nextId);window.widgets.set(id,{options,token:''});return id;},
      getResponse(id){return window.widgets.get(id)?.token||'';},
      reset(id){window.resets.push(id);const w=window.widgets.get(id);if(w)w.token='';},
      remove(id){window.removed.push(id);window.widgets.delete(id);}};
    window.forAction=action=>[...window.widgets.entries()].find(([,w])=>w.options.action===action);
    window.verify=(action,token)=>{const [,w]=window.forAction(action);w.token=token;w.options.callback(token);};
    window.expire=action=>{const [,w]=window.forAction(action);w.token='';w.options['expired-callback']();};
    window.fail=action=>{const [,w]=window.forAction(action);w.token='';w.options['error-callback']('fixture-error');};
    const append=document.head.appendChild.bind(document.head);
    document.head.appendChild=function(node){if(node.tagName==='SCRIPT'&&node.src.includes('challenges.cloudflare.com')){
      window.scriptsAdded++;node.removeAttribute('src');const result=append(node);setTimeout(()=>{
        const failed=new URLSearchParams(location.search).has('fail');if(!failed)window.turnstile=sdk;node.dispatchEvent(new Event(failed?'error':'load'));
      },100);return result;}return append(node);};
    function Demo({action}){const verification=useFormTurnstile(action);const [open,setOpen]=useState(true);window.controllers[action]=verification;
      return <section id={action} style={{width:action==='contact'?220:400}}><button data-toggle onClick={()=>setOpen(value=>!value)}>Toggle form</button>
        {open&&<FormTurnstile verification={verification}/>}<button data-submit disabled={!verification.token} onClick={()=>{verification.getToken();verification.reset();}}>Submit</button></section>;}
    createRoot(document.getElementById('app')).render(<>{['loan_application','inquiry','contact'].map(action=><Demo key={action} action={action}/>)}</>);
  `);
  await new Promise((resolve,reject)=>webpack({
    mode:'development',context:root,entry:path.join(work,'entry.jsx'),devtool:false,
    output:{path:work,filename:'bundle.js'},
    plugins:[new webpack.DefinePlugin({'process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY':JSON.stringify('fixture-site-key')})],
    resolve:{extensions:['.tsx','.ts','.jsx','.js']},
    module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(work,'loader.cjs')}]},
  },(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  const bundle=fs.readFileSync(path.join(work,'bundle.js'),'utf8');
  assert.equal(bundle.includes('TURNSTILE_SECRET_KEY'),false);
  assert.equal(bundle.includes('/turnstile/v0/siteverify'),false);
  const server=http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle);}
    else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="app"></div><script src="/bundle.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${path.join(work,`profile-${process.pid}`)}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let socket;
  try{
    const url=await new Promise((resolve,reject)=>{
      let output='';const timer=setTimeout(()=>reject(new Error('Browser startup timed out')),15000);
      browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      browser.on('error',error=>{clearTimeout(timer);reject(error);});browser.on('exit',code=>{clearTimeout(timer);reject(new Error(`Browser exited ${code}: ${output.slice(-300)}`));});
    });
    socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let id=0;const pending=new Map();const exceptions=[];
    socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);if(msg.id){const task=pending.get(msg.id);pending.delete(msg.id);if(task)msg.error?task.reject(new Error(JSON.stringify(msg.error))):task.resolve(msg.result);}};
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(new Error(`CDP timeout: ${method}`)),10000);pending.set(key,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id:key,method,params,...(sessionId?{sessionId}:{})}));});
    const target=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await send('Runtime.enable',{},sessionId);await send('Page.enable',{},sessionId);
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw new Error(`Timed out: ${expression}`);};
    const base=`http://127.0.0.1:${server.address().port}/`;
    await send('Page.navigate',{url:base},sessionId);
    await until('window.widgets?.size===3');
    assert.equal(await evaluate('window.scriptsAdded'),1);
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-submit]")].map(b=>b.disabled)'),[true,true,true]);
    await until('window.forAction("contact")[1].options.size === "compact"');
    assert.equal(await evaluate('window.forAction("inquiry")[1].options.size'),'normal');
    await evaluate('window.verify("inquiry","inquiry-token")');
    await until('!document.querySelector("#inquiry [data-submit]").disabled');
    assert.equal(await evaluate('document.querySelector("#contact [data-submit]").disabled'),true);
    assert.equal(await evaluate('window.controllers.inquiry.getToken()'),'inquiry-token');
    await evaluate('window.expire("inquiry")');
    await until('document.querySelector("#inquiry [data-submit]").disabled');
    assert.match(await evaluate('document.querySelector("#inquiry [role=alert]").textContent'),/expired/);
    await evaluate('window.verify("inquiry","fresh-token")');
    await until('!document.querySelector("#inquiry [data-submit]").disabled');
    await evaluate('document.querySelector("#inquiry [data-submit]").click()');
    await until('document.querySelector("#inquiry [data-submit]").disabled');
    assert.equal(await evaluate('window.resets.length'),1);
    await evaluate('window.verify("contact","contact-token");window.fail("contact")');
    await until('Boolean(document.querySelector("#contact [role=alert]"))');
    assert.equal(await evaluate('document.querySelector("#contact [data-submit]").disabled'),true);
    await evaluate('window.verify("loan_application","loan-token")');
    await until('!document.querySelector("#loan_application [data-submit]").disabled');
    const oldId=await evaluate('window.forAction("loan_application")[0]');
    await evaluate('document.querySelector("#loan_application [data-toggle]").click()');
    await until('!window.forAction("loan_application")');
    await evaluate('document.querySelector("#loan_application [data-toggle]").click()');
    await until('Boolean(window.forAction("loan_application"))');
    assert.notEqual(await evaluate('window.forAction("loan_application")[0]'),oldId);
    assert.equal(await evaluate('document.querySelector("#loan_application [data-submit]").disabled'),true);
    assert.equal(await evaluate('window.scriptsAdded'),1);
    await send('Page.navigate',{url:`${base}?fail=1`},sessionId);
    await until('document.querySelectorAll("[role=alert]").length===3');
    assert.deepEqual(await evaluate('[...document.querySelectorAll("[data-submit]")].map(b=>b.disabled)'),[true,true,true]);
    assert.match(await evaluate('document.querySelector("[role=alert]").textContent'),/could not load/);
    assert.deepEqual(exceptions,[]);
  }finally{if(socket)socket.close();browser.kill();await new Promise(resolve=>server.close(resolve));}
});
