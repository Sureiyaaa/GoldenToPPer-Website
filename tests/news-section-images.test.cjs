// Exercises the real News editor and shared ImageDropzone in Chromium.
// Storage, authentication and database calls are mocked; no live data is written.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const repoRequire = require('module').createRequire(path.join(root, 'package.json'));
const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'goldentopper-news-images-'));
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
const { webpack } = repoRequire('next/dist/compiled/webpack/webpack');
const postcss = repoRequire('postcss');
const tailwind = repoRequire('@tailwindcss/postcss');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#bda26b"/></svg>');
const body = text => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{type: 'bold'}] }] }] });
const initialArticle = { id: 'fixture', title: 'Inspector fixture', category: 'Updates', date: '2026-10-16', slug: 'inspector-fixture', excerpt: 'First section content', image, article_content: JSON.stringify(body('First section content')), article_layout: 'image-above', article_sections: { version: 1, createdAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z', sections: [
  { id: 'a', heading: 'First heading', headingEnabled: true, layout: 'image-above', body: body('First section content'), image, order: 0 },
  { id: 'b', headingEnabled: true, layout: 'image-contained', body: body('Second section content'), image, order: 1 },
  { id: 'c', heading: 'Third heading', headingEnabled: false, layout: 'text-only', body: body('Third section content'), image, order: 2 },
] } };
const write = (name, text) => fs.writeFileSync(path.join(work, name), text);
write('browse-a.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'));
write('browse-b.png', fs.readFileSync(path.join(work, 'browse-a.png')));
write('loader.cjs', 'const ts = require(' + JSON.stringify(repoRequire.resolve('typescript')) + ');' + " module.exports = function(source) { if(this.resourcePath.endsWith('news'+require('path').sep+'page.tsx')) {source=source.replace('const editorsRegistry = useRef<Map<string, Editor>>(new Map());','const editorsRegistry = useRef<Map<string, Editor>>(new Map()); (window as any).newsEditors=editorsRegistry.current;');source=source.replace('onChange: (body, sectionId) => {','onChange: (body, sectionId) => { (window as any).newsSectionUpdates.push({articleId: editId, sectionId, body: structuredClone(body)});');source=source.replace('  if (isFetching) {',\"(window as any).newsTest = { sections: () => sectionsRef.current, values: getValues, drafts: () => sectionImages.draftsRef.current, reorder: reorderSections, reset: handleReset, stage: stageSectionImage, remove: removeSection, syncSections: setSections, save: () => handleSubmit(onSubmit, showFirstInvalidField)() };\\n  if (isFetching) {\");}return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;};");
write('navigation.js', `import {useState,useEffect} from 'react'; export const useRouter = () => ({push() {}, replace() {}}); export const useSearchParams = () => { const [id,setId]=useState('fixture'); useEffect(()=>{window.fixtureNavigate=setId;return()=>{delete window.fixtureNavigate;};},[]); return new URLSearchParams('?edit='+id); };`);
write('data.js', `export const initial = ${JSON.stringify(initialArticle)}; const other={...initial,id:'other',title:'Other article',slug:'other-article',article_sections:{...initial.article_sections,sections:[{...initial.article_sections.sections[0],id:'other-a'}]}}; export const read = (id='fixture') => id==='other'?(window.otherNewsFixture||other):JSON.parse(localStorage.getItem('news-inspector-fixture') || JSON.stringify(initial)); window.uploadCalls=[];window.saveCalls=[];window.newsSectionUpdates=[];export const createClient = () => ({ from: () => ({ id:'fixture',select(){return this;},is(){return this;},eq(field,id){this.id=id;return this;},order:async()=>({data:[{id:'fixture',title:read().title},{id:'other',title:other.title}],error:null}),single:async function(){return {data:read(this.id),error:null};} }) }); export async function saveArticleToDB(value,id) {window.saveCalls.push({id,value:structuredClone(value)});if(window.failSave)throw Error('Fixture database failure');if(window.holdSave)await new Promise(resolve=>window.releaseSave=resolve);window.lastSaved=structuredClone(value);localStorage.setItem('news-inspector-fixture',JSON.stringify({id:'fixture',...value}));return {id:'fixture'};} export async function uploadImage(request) {const file=request.get('file');const fileName=request.get('fileName');window.uploadCalls.push({name:file.name,fileName,type:file.type,size:file.size,isFile:file instanceof File});if(window.holdUploads)await new Promise(resolve=>window.releaseUpload=resolve);if(window.failUpload)throw Error('Fixture storage failure');return location.origin+'/uploaded/'+fileName;} export async function createAuditLogAction(){}`);
write('entry.jsx', `import React from 'react'; import {createRoot} from 'react-dom/client'; import News from ${JSON.stringify(path.join(root, 'app/admin/news/page.tsx').replace(/\\/g, '/'))}; const root=createRoot(document.getElementById('app'));window.unmountNewsFixture=()=>root.unmount();root.render(<News/>);`);
async function main(t) {
  await new Promise((resolve, reject) => webpack({ mode: 'development', context: root, entry: path.join(work, 'entry.jsx'), devtool: false, output: {path: work, filename: 'bundle.js'}, resolve: { extensions: ['.tsx','.ts','.jsx','.js'], modules: [path.join(root, 'node_modules'), 'node_modules'], alias: { 'next/navigation': path.join(work, 'navigation.js'), '@/utils/supabase/client': path.join(work, 'data.js'), '@/app/actions/news': path.join(work, 'data.js'), '@/app/actions/admin_fetchers': path.join(work, 'data.js'), '@': root } }, module: {rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(work, 'loader.cjs') }]} }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false, errors:true}))) : resolve()));
  const css = await postcss([tailwind({base: root})]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), {from: path.join(root,'app/globals.css')});
  write('styles.css', css.css);
  write('index.html', '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>');
  const server = http.createServer((req,res) => { const file = path.join(work, req.url.startsWith('/uploaded/') ? 'browse-a.png' : req.url === '/' ? 'index.html' : path.basename(req.url)); if(!fs.existsSync(file)){res.writeHead(404);res.end();return;} res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html'); fs.createReadStream(file).pipe(res); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = spawn(chrome, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0', '--user-data-dir='+path.join(work, 'chrome-profile'), 'about:blank'], {windowsHide:true, stdio:['ignore','ignore','pipe']});
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

    let chooser; let dragData; let id = 0; let fixtureReload = false; let pageLoads = 0; const pending = new Map(); const exceptions = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data); if(message.method==='Page.fileChooserOpened') chooser=message.params; if (message.method === 'Input.dragIntercepted') dragData = message.params.data;
      if(message.method==='Page.loadEventFired')pageLoads++;
      // Starting a fresh fixture explicitly discards its draft. Native typing can
      // activate Chromium's beforeunload prompt, which otherwise blocks CDP reads.
      if(message.method==='Page.javascriptDialogOpening' && message.params.type==='beforeunload' && fixtureReload){
        send('Page.handleJavaScriptDialog',{accept:true},message.sessionId).catch(error=>exceptions.push(error.message));
      }
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text + ' ' + (message.params.exceptionDetails.exception?.description || ''));
      if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result); }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000); pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }).catch(error => { throw new Error(error.message + ' | ' + expression.slice(0, 160)); });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const size = async (width, height) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await wait(150); };
    await call('Runtime.enable');
    await size(1440, 900);
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    console.log('Navigated to isolated local fixture.');
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(`!!document.querySelector('#news-title')`)) break; await wait(100); }
    await evaluate(`document.fonts.ready`);


    const waitFor = async (expression,message) => {for(let i=0;i<120;i++){if(await evaluate(expression))return;await wait(60);}throw Error(message+' | '+exceptions.join('\n'));};
    const reloadPage = async () => {
      const previousLoads=pageLoads;fixtureReload=true;
      try{
        await call("Page.reload");
        for(let i=0;i<120 && pageLoads===previousLoads;i++)await wait(60);
        assert.ok(pageLoads>previousLoads,'wait for the new document instead of reading the outgoing page');
      }finally{fixtureReload=false;}
    };
    const ready = async () => waitFor("document.querySelector('[data-news-panel=\"overview\"]') && document.querySelectorAll('[data-section-id]').length===3",'Fixture did not load');
    const click = async selector => {await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');await wait(100);};
    const preview = id => '[data-news-preview-section="'+id+'"] [data-news-target="image"]';
    const img = () => evaluate("document.querySelector('aside img')?.getAttribute('src')");
    const canonical = id => evaluate('window.newsTest.sections().sections.find(s=>s.id==='+JSON.stringify(id)+')?.image');
    const save = async () => {await click('header button:has(svg.lucide-save)');};
    const reset = async () => {await click('header button:has(svg.lucide-rotate-ccw)');};
    const back = async () => {await evaluate("Array.from(document.querySelectorAll('aside button')).find(e=>e.textContent.includes('Back to overview')).click()");await wait(80);};
    const sectionImage = async id => {await click(preview(id));assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'section-image');assert.equal(await evaluate("!!document.querySelector('aside input[type=url], aside #news-title, aside [aria-label=\"Article sections\"]')"),false);};
    const fixture = async (article = null) => {
      await evaluate('localStorage.clear()');if(article)await evaluate('localStorage.setItem("news-inspector-fixture",'+JSON.stringify(JSON.stringify(article))+')');
      await reloadPage();await wait(150);
      if(article && !article.article_sections)await waitFor("document.querySelector('[data-news-panel=\"overview\"]') && document.querySelectorAll('[data-section-id]').length===1",'Legacy fixture did not load');else await ready();
      await call('Page.setInterceptFileChooserDialog',{enabled:true});await evaluate("window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revoked.push(url);revoke(url);};");
    };
    const browse = async filename => {
      chooser=null;
      await evaluate("(() => {const button=Array.from(document.querySelectorAll('aside button')).find(e=>e.textContent.includes('Replace Image'));if(button)button.click();else document.querySelector('aside [role=\"button\"]').click();})()");
      for(let i=0;i<30&&!chooser;i++)await wait(30);
      assert.ok(chooser,'Browse opens native file chooser');
      await call('DOM.setFileInputFiles',{files:[path.join(work,filename)],backendNodeId:chooser.backendNodeId});await wait(140);
    };
    const drop = async filename => {
      const p=await evaluate("(() => {const r=document.querySelector('aside [aria-busy]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
      const data={items:[],files:[path.join(work,filename)],dragOperationsMask:1};
      for(const type of ['dragEnter','dragOver','drop'])await call('Input.dispatchDragEvent',{type,...p,data});await wait(150);
    };
    const remove = async () => {await evaluate("Array.from(document.querySelectorAll('aside button')).find(e=>e.textContent.includes('Remove Image')).click()");await wait(100);};
    const invalid = async (name,type,size) => {await evaluate('(() => {const input=document.querySelector("aside input[type=file]");const dt=new DataTransfer();dt.items.add(new File([new Uint8Array('+size+')],'+JSON.stringify(name)+',{type:'+JSON.stringify(type)+'}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()');await wait(100);};
    const completed = async () => waitFor("!!window.lastSaved && !document.querySelector('header button:has(svg.lucide-loader-circle)') && !!document.querySelector('[data-news-panel=\"overview\"]')",'Save did not finish');
    const heldUpload = async () => {await evaluate('window.holdUploads=true');await save();await waitFor('window.uploadCalls.length>0 && !!window.releaseUpload','Upload did not start');};
    const release = async () => {await evaluate('window.holdUploads=false;window.releaseUpload()');await wait(150);};
    const placement = async label => {await evaluate('Array.from(document.querySelectorAll(\'aside [aria-label="Image placement"] button\')).find(button=>button.textContent.includes('+JSON.stringify(label)+')).click()');await wait(100);};
    const storedLayout = id => evaluate('window.newsTest.sections().sections.find(s=>s.id==='+JSON.stringify(id)+').layout');
    const choices = () => evaluate("Array.from(document.querySelectorAll('aside [aria-label=\"Image placement\"] button')).map(button=>button.querySelector('div').textContent)");
    const allChoices = ['Image Above','Image Below','Image Left','Image Right'];
    const noArticleLayout = async () => assert.equal(await evaluate("/Article Layout|Image Hero|Title First|Image Contained|Sidebar Right|Sidebar Left/i.test(document.querySelector('aside').textContent)"),false,'obsolete article layout panel/label is absent');
    const overviewOrder = async () => {
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('aside #news-title, aside #news-category, aside #news-slug, aside [aria-label=\"Article sections\"]')).map(el=>el.id||el.getAttribute('aria-label'))"),['news-title','news-category','news-slug','Article sections']);
      await noArticleLayout();
    };
    await call('Page.enable');
    const cover = '[aria-label="Edit article cover image"]';
    const coverSwitch = 'aside [role="switch"][aria-labelledby="news-cover-visibility-label"]';
    await fixture();await click(cover);
    assert.equal(await evaluate('document.querySelector('+JSON.stringify(coverSwitch)+').getAttribute("aria-checked")'),'true','missing visibility defaults to visible');
    await evaluate("window.coverEditor=window.newsEditors.get('a');window.coverSections=JSON.stringify(window.newsTest.sections());void 0;");
    await click(coverSwitch);
    assert.equal(await evaluate('window.newsTest.values().show_cover_on_article'),false);
    assert.equal(await evaluate('window.newsTest.values().image'),image,'hiding never clears the asset');
    assert.equal(await evaluate("document.querySelectorAll('[data-news-cover]').length"),0);
    assert.equal(await evaluate("document.querySelector('.news-article-header').offsetTop"),0,'hidden cover leaves no reserved height');
    assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),false,'visibility changes dirty the form');
    await back();await click(cover);assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'image','hidden cover inspector remains accessible');
    assert.equal(await evaluate('getComputedStyle(document.querySelector('+JSON.stringify(cover)+')).position'),'absolute','editing affordance is outside article flow');
    await click(coverSwitch);assert.equal(await evaluate("document.querySelector('[data-news-cover] img').getAttribute('src')"),image);
    assert.equal(await evaluate('JSON.stringify(window.newsTest.sections())===window.coverSections'),true);
    assert.equal(await evaluate("window.newsEditors.get('a')===window.coverEditor"),true);
    assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'restoring the original preference returns to clean state');
    await click(coverSwitch);await reset();assert.equal(await evaluate('window.newsTest.values().show_cover_on_article'),true,'Reset restores visible default');
    await click(cover);await click(coverSwitch);await save();await completed();
    assert.equal(await evaluate('window.lastSaved.show_cover_on_article'),false);assert.equal(await evaluate('window.lastSaved.image'),image);
    await reloadPage();await wait(200);await ready();assert.equal(await evaluate("!!document.querySelector('[data-news-cover]')"),false);
    await click(cover);assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'reopening persisted hidden cover stays clean');
    await click(coverSwitch);await reset();assert.equal(await evaluate('window.newsTest.values().show_cover_on_article'),false,'Reset restores persisted hidden preference');
    await click(cover);await browse('browse-a.png');assert.equal(await evaluate("!!document.querySelector('[data-news-cover]')"),false,'replacement respects hidden preference');
    await reset();assert.equal(await evaluate('window.newsTest.values().image'),image,'Reset discards staged cover replacement');
    await click(cover);await browse('browse-b.png');await save();await completed();
    const replacementCover=await evaluate('window.lastSaved.image');assert.ok(replacementCover.includes('/uploaded/'));assert.equal(await evaluate('window.lastSaved.show_cover_on_article'),false);
    assert.deepEqual(await evaluate('window.lastSaved.article_sections.sections.map(s=>s.image)'),initialArticle.article_sections.sections.map(s=>s.image),'cover replacement leaves section images unchanged');
    await click(cover);await click(coverSwitch);await save();await completed();await reloadPage();await wait(200);await ready();
    assert.equal(await evaluate("document.querySelector('[data-news-cover] img').getAttribute('src')"),replacementCover,'re-enabling restores the saved replacement');
    await click(cover);await remove();assert.equal(await evaluate('window.newsTest.values().image'),'');assert.equal(await evaluate("!!document.querySelector('[data-news-cover]')"),false);await reset();assert.equal(await evaluate('window.newsTest.values().image'),replacementCover);
    console.log('PASS cover visibility default/hide/reopen/restore, no reserved space, independent section/editor state, mock Save/reload, persisted Reset, hidden cover replace/remove');
    const legacyLayoutCases = [
      ...['image-above','title-above','image-contained','sidebar-image-right','sidebar-image-left'].map(layout=>({layout,expected:layout})),
      {layout:undefined,expected:'image-above'},
      {layout:null,expected:'image-above'},
    ];
    for(const [index,{layout,expected}] of legacyLayoutCases.entries()){
      // Include older records without article_sections, exercising the legacy adapter.
      const article={...initialArticle,article_layout:layout,article_sections:index%2?null:initialArticle.article_sections};
      await fixture(article);await overviewOrder();
      assert.equal(await evaluate('window.newsTest.values().article_layout'),expected,'loading retains historical values and applies the editor default for absent/null layouts');
      assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
      await evaluate("window.newsEditors.get(window.newsTest.sections().sections[0].id).commands.insertContent(' discarded edit')");await reset();
      assert.equal(await evaluate('window.newsTest.values().article_layout'),expected,'Reset restores the loaded article layout');
      assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
      await evaluate("window.newsEditors.get(window.newsTest.sections().sections[0].id).commands.insertContent(' saved edit')");await save();await completed();
      assert.equal(await evaluate('window.lastSaved.article_layout'),expected,'Save preserves each historical layout or the editor default');
      await reloadPage();await waitFor('!!document.querySelector("#news-title") && window.newsTest.values().article_layout==='+JSON.stringify(expected),'Saved article failed to reload');await overviewOrder();
    }
    await fixture();
    for(const [selector,panel] of [
      ['[data-news-header-part="title"]','header'],['[data-news-header-part="date"]','header'],['[aria-label="Edit article cover image"]','image'],
      [preview('a'),'section-image'],['[data-news-preview-section="a"] [data-news-target="heading"]','section-heading'],
      ['[data-news-preview-section="a"] [data-news-target="body"]','sections'],['[aria-label="Select First heading"]','sections'],
    ]){
      await click(selector);assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),panel);await noArticleLayout();
      if(panel==='section-image'||panel==='sections')assert.deepEqual(await choices(),allChoices);
      assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'preview/card selection alone stays clean');
      await back();await overviewOrder();
    }
    console.log('PASS no article layout UI, overview field order, contextual selection/Back stays clean, all five legacy article_layout values survive load/Reset/Save/reload; omitted/null values use the editor default');
    const editInput = async (selector,value) => {
      await evaluate('(()=>{const input=document.querySelector('+JSON.stringify(selector)+');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(value)+');input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));})()');await wait(100);
    };
    for(const width of [1440,375]){
      await size(width,900);
      for(const visible of [true,false]){
        await fixture({...initialArticle,show_cover_on_article:visible});
        for(const part of ['title','date']){
          await click('[data-news-header-part="'+part+'"]');
          assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'header');
          assert.equal(await evaluate("document.querySelector('aside h2').textContent.trim()"),'Article Header');
          assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('aside input')).map(input=>input.id)"),['news-title','news-date']);
          assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Edit article header\"]').length"),1);
          assert.equal(await evaluate("(()=>{const group=document.querySelector('[aria-label=\"Edit article header\"]');const title=document.querySelector('[data-news-header-part=title]');const date=document.querySelector('[data-news-header-part=date]');const cover=document.querySelector('[aria-label=\"Edit article cover image\"]');return group.getAttribute('aria-pressed')==='true' && group.classList.contains('ring-2') && group.contains(title) && group.contains(date) && !group.contains(cover) && group.querySelectorAll('button,.ring-2').length===0;})()"),true,'one selection boundary includes title/date and excludes the cover');
          assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
          await back();await overviewOrder();
        }
        await click(cover);assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'image');
        assert.equal(await evaluate("document.querySelector('[aria-label=\"Edit article header\"]').getAttribute('aria-pressed')"),'false');await back();
      }
    }
    await size(1440,900);await fixture();await click('[data-news-header-part="title"]');
    await editInput('#news-title','Updated article header');await editInput('#news-date','2026-11-02');
    assert.equal(await evaluate("document.querySelector('[data-news-header-part=title]').textContent"),'Updated article header');
    assert.equal(await evaluate("document.querySelector('[data-news-header-part=date]').textContent.trim()"),'2026-11-02');
    assert.equal(await evaluate('window.newsTest.values().slug'),initialArticle.slug,'header edits preserve slug behavior');
    await reset();assert.equal(await evaluate('window.newsTest.values().title'),initialArticle.title);assert.equal(await evaluate('window.newsTest.values().date'),initialArticle.date);
    for(const [field,message] of [['title','Title is required'],['date','Date is required']]){
      await click('[data-news-header-part="date"]');await editInput('#news-'+field,'');await back();await save();
      assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'header','invalid header fields reopen the consolidated panel');
      assert.equal(await evaluate('document.querySelector("aside").textContent.includes('+JSON.stringify(message)+')'),true);
      await reset();
    }
    await click('[data-news-header-part="date"]');await editInput('#news-title','Saved article header');await editInput('#news-date','2026-11-03');
    await save();await completed();assert.equal(await evaluate('window.lastSaved.title'),'Saved article header');assert.equal(await evaluate('window.lastSaved.date'),'2026-11-03');assert.equal(await evaluate('window.lastSaved.slug'),initialArticle.slug);
    await reloadPage();await wait(200);await ready();await click('[data-news-header-part="date"]');
    assert.equal(await evaluate('document.querySelector("#news-title").value'),'Saved article header');assert.equal(await evaluate('document.querySelector("#news-date").value'),'2026-11-03');
    await editInput('#news-title','Discarded title');await editInput('#news-date','2026-11-04');await reset();
    assert.equal(await evaluate('window.newsTest.values().title'),'Saved article header');assert.equal(await evaluate('window.newsTest.values().date'),'2026-11-03');
    await evaluate("window.headerEditor=window.newsEditors.get('a');window.headerEditor.commands.insertContent(' unsaved body');window.headerBody=window.headerEditor.getJSON();void 0;");
    await click('[data-news-header-part="title"]');await click('[data-news-header-part="date"]');await back();
    assert.equal(await evaluate("window.newsEditors.get('a')===window.headerEditor && window.headerEditor.can().undo()"),true);
    assert.deepEqual(await evaluate('window.headerEditor.getJSON()'),await evaluate('window.headerBody'));await reset();await fixture();
    console.log('PASS consolidated header selection/outline with visible/hidden covers at desktop/mobile widths, title/date synchronization and validation, stable slug, mock Save/reload/Reset and preserved body history');
    const sectionBody = id => '[data-news-preview-section="'+id+'"] [data-news-target="body"]';
    const bodyValue = id => evaluate('window.newsTest.sections().sections.find(section=>section.id==='+JSON.stringify(id)+').body');
    const nativeClick = async selector => {
      const point=await evaluate('(()=>{const el=document.querySelector('+JSON.stringify(selector)+');el.scrollIntoView({block:"center",behavior:"instant"});const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
      await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await wait(110);
    };
    const key = async value => {await call('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value});await call('Input.dispatchKeyEvent',{type:'keyUp',key:value,code:value});await wait(70);};
    const emptyCue = id => evaluate('(() => {const body=document.querySelector('+JSON.stringify(sectionBody(id))+');const surface=body.querySelector(".ProseMirror,.news-section-body-preview");const hint=getComputedStyle(surface,"::before");return {empty:body.dataset.empty==="true",hint:hint.content,height:surface.getBoundingClientRect().height,pointerEvents:hint.pointerEvents,text:surface.textContent,description:body.getAttribute("aria-description")};})()');
    const placeholder = "Click here to write your section's paragraph...";
    const emptyArticle = structuredClone(initialArticle);
    emptyArticle.article_sections.sections[1].body={type:'doc',content:[{type:'paragraph'}]};
    for(const width of [1440,375]){
      await size(width,900);await fixture(emptyArticle);
      const savedEmpty=await bodyValue('b');
      assert.equal((await emptyCue('b')).empty,true,'unselected empty body is discoverable');
      // Native keyboard activation of the existing click-to-edit surface.
      await evaluate('document.querySelector('+JSON.stringify(sectionBody('b'))+').focus()');await key('Enter');
      assert.equal(await evaluate("document.querySelector('[data-news-preview-section=b] .ProseMirror')===document.activeElement"),true);
      assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'focus and selection stay clean');
      assert.deepEqual(await bodyValue('b'),savedEmpty,'displaying/focusing the cue does not normalize the document');
      await editInput('#section-heading','Optional heading');
      for(const label of allChoices){
        await placement(label);
        for(const heading of [true,false]){
          if(await evaluate("!document.querySelector('#section-heading').disabled")!==heading)await click('aside [aria-label="'+(heading?'Enable':'Disable')+' heading"]');
          for(const hasImage of [true,false]){
            if(!hasImage)await remove();
            const cue=await emptyCue('b');assert.equal(cue.empty,true);assert.ok(cue.hint.includes(placeholder));assert.equal(cue.pointerEvents,'none');assert.ok(cue.height>=64);assert.equal(cue.text,'');assert.equal(cue.description,placeholder);
            await nativeClick(sectionBody('b'));
            assert.equal(await evaluate("document.querySelector('[data-news-preview-section=b] .ProseMirror')===document.activeElement"),true,'whole empty area accepts a native click');
            if(!hasImage)await browse('browse-a.png');
          }
        }
      }
      await nativeClick(sectionBody('b'));await call('Input.insertText',{text:'A newly written paragraph'});await wait(100);
      assert.equal((await emptyCue('b')).empty,false);assert.equal((await emptyCue('b')).hint,'none');
      await wait(550); // Keep typing and clearing as separate undo steps.
      await evaluate("window.emptyEditor=window.newsEditors.get('b');window.emptyEditor.commands.selectAll();void 0;");
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await wait(100);
      assert.equal((await emptyCue('b')).empty,true,'clearing via keyboard restores the cue');
      await evaluate('window.emptyEditor.commands.undo()');await wait(80);assert.equal((await emptyCue('b')).empty,false);
      await evaluate('window.emptyEditor.commands.redo()');await wait(80);assert.equal((await emptyCue('b')).empty,true);
      await click(sectionBody('a'));assert.equal((await emptyCue('a')).empty,false);assert.equal((await emptyCue('b')).empty,true);
      await nativeClick(sectionBody('b'));assert.equal(await evaluate("window.newsEditors.get('b')===window.emptyEditor && window.emptyEditor.can().undo()"),true);
      await back();await save();await completed();
      assert.equal(await evaluate('JSON.stringify(window.lastSaved).includes('+JSON.stringify(placeholder)+')'),false,'placeholder is absent from saved JSON, excerpt and legacy content');
      await reloadPage();await wait(200);await ready();assert.equal((await emptyCue('b')).empty,true);
      await nativeClick(sectionBody('b'));await call('Input.insertText',{text:'Discard this edit'});await wait(100);assert.equal((await emptyCue('b')).empty,false);
      await reset();assert.equal((await emptyCue('b')).empty,true);assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
    }
    await size(1440,900);await fixture();
    await evaluate("Array.from(document.querySelectorAll('aside button')).find(button=>button.textContent.includes('Add Section')).click()");await wait(100);
    const emptyNewId=await evaluate('window.newsTest.sections().sections.at(-1).id');assert.equal((await emptyCue(emptyNewId)).empty,true);
    await browse('browse-a.png');assert.equal((await emptyCue(emptyNewId)).empty,true,'image-first section retains its empty text cue');
    await nativeClick(sectionBody(emptyNewId));await call('Input.insertText',{text:'Image first, then text'});await wait(100);assert.equal((await emptyCue(emptyNewId)).empty,false);await reset();
    await evaluate("Array.from(document.querySelectorAll('aside button')).find(button=>button.textContent.includes('Add Section')).click()");await wait(100);
    const textFirstId=await evaluate('window.newsTest.sections().sections.at(-1).id');await nativeClick(sectionBody(textFirstId));await call('Input.insertText',{text:'Text first, then image'});await wait(100);await browse('browse-a.png');assert.equal((await emptyCue(textFirstId)).empty,false);assert.ok(JSON.stringify(await bodyValue(textFirstId)).includes('Text first, then image'));await reset();
    console.log('PASS empty cue, native click/type/clear and keyboard activation, image/text order, four placements with/without images/headings at desktop/mobile widths, clean focus, section switching, undo/redo and mock Save/reload/Reset; no persisted placeholder');
    await fixture();
    const completeSectionSettings = async () => {
      assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'sections');
      assert.equal(await evaluate("document.querySelector('aside h2').textContent.trim()"),'Section Settings');
      assert.equal(await evaluate("document.querySelectorAll('aside [aria-label=Bold],aside [aria-label=Italic],aside #section-heading,aside input[type=file]').length"),4);
      assert.deepEqual(await evaluate("[...document.querySelectorAll('aside p,aside label')].map(el=>el.textContent.trim()).filter(text=>['Text Formatting','Section Heading','Section Image','Image placement'].includes(text))"),['Text Formatting','Section Heading','Section Image','Image placement']);
      assert.equal(await evaluate("document.querySelector('aside').textContent.includes('Section ID') || !!document.querySelector('aside .font-mono')"),false);
      assert.equal(await evaluate("document.querySelectorAll('.ProseMirror').length"),1,'one editing surface remains mounted');
    };
    for(const width of [1440,375]){
      await size(width,900);await fixture();
      for(const id of ['a','b']){
        await click(sectionBody(id));await completeSectionSettings();
        assert.equal(await evaluate('document.querySelector('+JSON.stringify(sectionBody(id))+').classList.contains("ring-2")'),true,'selected body retains its outline');
        assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
        await back();await click('[data-section-id="'+id+'"] button[aria-label^="Select"]');await completeSectionSettings();
        assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true);
        await click(preview(id));assert.equal(await evaluate("document.querySelector('[data-news-panel]').dataset.newsPanel"),'section-image');
        assert.equal(await evaluate("document.querySelectorAll('aside [aria-label=Bold],aside #section-heading').length"),0,'dedicated section image panel remains separate');await back();
      }
    }
    await t.test('native formatting and history shortcuts update the selected text and toolbar states',async()=>{
      await size(1440,900);await fixture();await nativeClick(sectionBody('a'));
      await evaluate('window.shortcutEditor=window.newsEditors.get("a");window.shortcutEditor.commands.focus();window.shortcutEditor.commands.setTextSelection({from:1,to:6});void 0;');await wait(80);
      const shortcut=async letter=>{
        const event={key:letter,code:'Key'+letter.toUpperCase(),windowsVirtualKeyCode:letter.toUpperCase().charCodeAt(0),modifiers:2};
        await call('Input.dispatchKeyEvent',{type:'keyDown',...event});await call('Input.dispatchKeyEvent',{type:'keyUp',...event});await wait(100);
      };
      const states=()=>evaluate('({bold:document.querySelector("aside [aria-label=Bold]").getAttribute("aria-pressed"),italic:document.querySelector("aside [aria-label=Italic]").getAttribute("aria-pressed")})');
      const assertMarks=async expected=>{
        assert.deepEqual((await bodyValue('a')).content[0].content[0].marks?.map(mark=>mark.type).sort()||[],expected);
        assert.deepEqual(await states(),{bold:String(expected.includes('bold')),italic:String(expected.includes('italic'))});
      };
      const unchangedB=await bodyValue('b');
      await assertMarks(['bold']);
      await shortcut('b');await assertMarks([]);
      await shortcut('b');await assertMarks(['bold']);
      await shortcut('i');await assertMarks(['bold','italic']);
      const combined=await bodyValue('a');
      await shortcut('i');await assertMarks(['bold']);
      await shortcut('z');await assertMarks(['bold','italic']);assert.deepEqual(await bodyValue('a'),combined);
      await shortcut('y');await assertMarks(['bold']);
      await evaluate('window.shortcutEditor.commands.setTextSelection({from:7,to:12});void 0;');await wait(80);
      assert.deepEqual(await states(),{bold:'true',italic:'false'});
      await evaluate('window.shortcutEditor.commands.setTextSelection({from:1,to:6});void 0;');await shortcut('i');await assertMarks(['bold','italic']);
      await evaluate('window.shortcutEditor.commands.setTextSelection({from:7,to:12});void 0;');await wait(80);
      assert.deepEqual(await evaluate('({bold:window.shortcutEditor.isActive("bold"),italic:window.shortcutEditor.isActive("italic"),from:window.shortcutEditor.state.selection.from,to:window.shortcutEditor.state.selection.to})'),{bold:true,italic:false,from:7,to:12},'the editor selection itself has only bold marks');
      assert.deepEqual(await states(),{bold:'true',italic:'false'},'toolbar follows the newly selected text, not previous marks');
      await evaluate('window.shortcutEditor.commands.setTextSelection({from:1,to:6});void 0;');await wait(80);
      assert.deepEqual(await states(),{bold:'true',italic:'true'});
      assert.deepEqual(await bodyValue('b'),unchangedB,'shortcuts cannot format another section');
    });
    await t.test('toolbar selection states and styling follow all mark combinations and section switches at desktop/mobile widths',async()=>{
      const markedArticle=structuredClone(initialArticle);
      markedArticle.article_sections.sections[0].body={type:'doc',content:[{type:'paragraph',content:[
        {type:'text',text:'Plain '},{type:'text',text:'Bold ',marks:[{type:'bold'}]},
        {type:'text',text:'Italic ',marks:[{type:'italic'}]},{type:'text',text:'Both',marks:[{type:'bold'},{type:'italic'}]},
      ]}]};
      for(const width of [1440,375]){
        await size(width,900);await fixture(markedArticle);await nativeClick(sectionBody('a'));
        await evaluate('window.markEditor=window.newsEditors.get("a");void 0;');
        const assertToolbar=async(bold,italic)=>{
          const buttons=await evaluate('["Bold","Italic"].map(label=>{const button=document.querySelector("aside [aria-label="+label+"]");return {pressed:button.getAttribute("aria-pressed"),activeStyle:button.classList.contains("bg-brand-blue") && button.classList.contains("text-white"),disabled:button.disabled};})');
          assert.deepEqual(buttons,[bold,italic].map(active=>({pressed:String(active),activeStyle:active,disabled:false})));
        };
        for(const [from,to,bold,italic] of [[1,6,false,false],[7,11,true,false],[12,18,false,true],[19,23,true,true]]){
          await evaluate('window.markEditor.commands.focus();window.markEditor.commands.setTextSelection({from:'+from+',to:'+to+'});void 0;');await wait(80);
          await assertToolbar(bold,italic);
        }
        assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'selecting marks alone leaves the form clean');
        await click(sectionBody('b'));await wait(80);await assertToolbar(true,false);
        await click(sectionBody('a'));await wait(80);await assertToolbar(true,true);
        assert.equal(await evaluate('window.newsEditors.get("a")===window.markEditor'),true);
        await nativeClick('aside [aria-label="Bold"]');await assertToolbar(false,true);
        await nativeClick('aside [aria-label="Italic"]');await assertToolbar(false,false);
        assert.deepEqual(await evaluate('({from:window.markEditor.state.selection.from,to:window.markEditor.state.selection.to})'),{from:19,to:23},'toolbar clicks preserve the selected range');
      }
    });
    await size(1440,900);await fixture();await nativeClick(sectionBody('b'));await completeSectionSettings();
    assert.equal(await evaluate("document.querySelector('[data-news-preview-section=\"b\"] .ProseMirror').contains(document.activeElement)"),true,'activating a new body keeps focus in its inline editor');
    await click(sectionBody('a'));
    await evaluate("window.settingsA=window.newsEditors.get('a');window.settingsA.commands.focus();window.settingsA.commands.setTextSelection({from:1,to:6});window.originalB=window.newsTest.sections().sections.find(section=>section.id==='b').body;void 0;");await wait(80);
    await nativeClick('aside [aria-label="Italic"]');
    const italicA=await bodyValue('a');assert.deepEqual(italicA.content[0].content[0].marks.map(mark=>mark.type).sort(),['bold','italic']);
    assert.deepEqual(await bodyValue('b'),await evaluate('window.originalB'));
    assert.deepEqual(await evaluate('({from:window.settingsA.state.selection.from,to:window.settingsA.state.selection.to})'),{from:1,to:6},'native toolbar click retains selected range');
    await nativeClick('aside [aria-label="Bold"]');const formattedA=await bodyValue('a');assert.deepEqual(formattedA.content[0].content[0].marks.map(mark=>mark.type),['italic']);
    await evaluate('window.settingsA.commands.undo()');await wait(80);assert.deepEqual(await bodyValue('a'),italicA);await evaluate('window.settingsA.commands.redo()');await wait(80);assert.deepEqual(await bodyValue('a'),formattedA);
    await click(sectionBody('b'));await evaluate("window.settingsB=window.newsEditors.get('b');window.settingsB.commands.focus();window.settingsB.commands.setTextSelection({from:1,to:7});void 0;");await wait(80);
    await nativeClick('aside [aria-label="Italic"]');const formattedB=await bodyValue('b');assert.deepEqual(formattedB.content[0].content[0].marks.map(mark=>mark.type).sort(),['bold','italic']);assert.deepEqual(await bodyValue('a'),formattedA);
    await call('Input.insertText',{text:'Inline body edit'});await wait(100);const typedB=await bodyValue('b');assert.ok(JSON.stringify(typedB).includes('Inline body edit'));
    await back();await evaluate("document.querySelector('[data-section-id=\"b\"] button[aria-label^=Reorder]').focus()");await key('Enter');await key('Home');await key('Enter');
    assert.deepEqual(await evaluate('window.newsTest.sections().sections.map(section=>section.id)'),['b','a','c']);
    assert.equal(await evaluate("window.newsEditors.get('a')===window.settingsA && window.newsEditors.get('b')===window.settingsB && window.settingsA.can().undo() && window.settingsB.can().undo()"),true,'keyboard drag preserves ID ownership and both histories');
    await click(sectionBody('a'));await completeSectionSettings();await editInput('#section-heading','Updated section heading');
    await click('aside [aria-label="Disable heading"]');assert.equal(await evaluate('window.newsTest.sections().sections.find(section=>section.id==="a").heading'),'Updated section heading');
    assert.equal(await evaluate("document.querySelector('#section-heading').disabled"),true);await click('aside [aria-label="Enable heading"]');
    await remove();assert.deepEqual(await choices(),[]);assert.equal(await storedLayout('a'),'image-above');
    await browse('browse-a.png');await placement('Image Right');await click(preview('a'));await browse('browse-b.png');await click(sectionBody('a'));await completeSectionSettings();
    assert.equal(await storedLayout('a'),'image-right');assert.equal(await evaluate("window.newsEditors.get('a')===window.settingsA"),true);assert.deepEqual(await bodyValue('a'),formattedA);assert.deepEqual(await bodyValue('b'),typedB);
    await save();await completed();assert.deepEqual(await evaluate('window.lastSaved.article_sections.sections.map(section=>section.id)'),['b','a','c']);
    assert.deepEqual(await evaluate("window.lastSaved.article_sections.sections.find(section=>section.id==='a').body"),formattedA);assert.deepEqual(await evaluate("window.lastSaved.article_sections.sections.find(section=>section.id==='b').body"),typedB);
    assert.ok((await evaluate("window.lastSaved.article_sections.sections.find(section=>section.id==='a').image")).includes('/uploaded/'));assert.equal(await evaluate('window.lastSaved.image'),image);
    await reloadPage();await wait(200);await ready();await click(sectionBody('a'));await completeSectionSettings();assert.equal(await evaluate('document.querySelector("#section-heading").value'),'Updated section heading');
    await evaluate("window.newsEditors.get('a').commands.insertContent(' discarded body')");await editInput('#section-heading','Discarded heading');await reset();
    assert.deepEqual(await bodyValue('a'),formattedA);assert.equal(await evaluate("window.newsTest.sections().sections.find(section=>section.id==='a').heading"),'Updated section heading');
    await evaluate("window.deletedEditor=window.newsEditors.get('a');void 0;");await click('[data-section-id="a"] button[aria-label^="Delete"]');
    assert.equal(await evaluate("!window.newsEditors.has('a') && window.deletedEditor.isDestroyed"),true,'removal cleans up the correct editor');assert.deepEqual(await bodyValue('b'),typedB);
    const afterRemoval = await evaluate('({sections:window.newsTest.sections(),updates:window.newsSectionUpdates})');
    await evaluate("void window.deletedEditor.emit('update',{editor:window.deletedEditor})");await wait(70);
    assert.deepEqual(await evaluate('({sections:window.newsTest.sections(),updates:window.newsSectionUpdates})'),afterRemoval,'a late event from the destroyed editor neither resurrects its section nor invokes a stale callback');
    await reset();await fixture();
    console.log('PASS body/card share complete Section Settings, control order/ID removal, native Bold/Italic/range targeting, correct sections, inline focus/typing, keyboard drag, history, mock Save/reload/Reset, image workflow and editor cleanup');
    await click('[aria-label="Select Third heading"]');
    assert.deepEqual(await choices(),allChoices);
    assert.equal(await evaluate("document.querySelectorAll('aside [aria-label=\"Image placement\"] [aria-pressed=true]').length"),0,'legacy text-only has no implied visible placement');
    assert.equal(await evaluate('!!document.querySelector('+JSON.stringify(preview('c'))+')'),false,'legacy stored image stays hidden');
    assert.equal(await storedLayout('c'),'text-only');assert.equal(await canonical('c'),image);
    assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'selection does not migrate layouts or dirty form');
    await evaluate("window.layoutEditor=window.newsEditors.get('c');window.originalBody=window.layoutEditor.getJSON();window.layoutEditor.commands.insertContent(' unsaved formatting edit');window.editedBody=window.layoutEditor.getJSON();window.layoutEditorElement=document.querySelector('[data-news-preview-section=\"c\"] .ProseMirror');void 0;");
    await save();await completed();
    assert.equal(await evaluate("window.lastSaved.article_sections.sections.find(s=>s.id==='c').layout"),'text-only');
    assert.equal(await evaluate("window.lastSaved.article_sections.sections.find(s=>s.id==='c').image"),image,'saving content preserves the hidden image');
    assert.equal(await evaluate("window.lastSaved.article_sections.sections.find(s=>s.id==='b').layout"),'image-contained','unrelated legacy placement is not rewritten');
    await click('[aria-label="Select Third heading"]');
    for(const label of allChoices){
      await placement(label);
      assert.equal(await evaluate("window.newsEditors.get('c')===window.layoutEditor && window.layoutEditor.can().undo()"),true,'placement preserves editor identity and undo');
      assert.equal(await evaluate("document.querySelector('[data-news-preview-section=\"c\"] .ProseMirror')===window.layoutEditorElement"),true,'placement preserves mounted editor DOM');
      assert.deepEqual(await evaluate('window.layoutEditor.getJSON()'),await evaluate('window.editedBody'));
    }
    await evaluate('window.layoutEditor.commands.undo()');await wait(80);assert.deepEqual(await evaluate('window.layoutEditor.getJSON()'),await evaluate('window.originalBody'));
    await evaluate('window.layoutEditor.commands.redo()');await wait(80);assert.deepEqual(await evaluate('window.layoutEditor.getJSON()'),await evaluate('window.editedBody'));
    await remove();assert.equal(await storedLayout('c'),'image-right');assert.deepEqual(await choices(),[]);
    await browse('browse-a.png');assert.deepEqual(await choices(),allChoices);assert.equal(await storedLayout('c'),'image-right');
    assert.equal(await evaluate("document.querySelector('aside [aria-label=\"Image placement\"] [aria-pressed=true]').textContent.includes('Image Right')"),true);
    assert.equal(await evaluate("document.querySelector('[data-news-preview-section=\"c\"] .ProseMirror')===window.layoutEditorElement"),true,'staging/removal preserves mounted editor DOM');
    assert.ok((await img()).startsWith('blob:'));await reset();
    assert.equal(await storedLayout('c'),'text-only');assert.equal(await canonical('c'),image);assert.equal(await evaluate('!!document.querySelector('+JSON.stringify(preview('c'))+')'),false);
    await click('[aria-label="Select Third heading"]');await placement('Image Right');await browse('browse-a.png');await save();await completed();
    await reloadPage();await wait(200);await ready();assert.equal(await storedLayout('c'),'image-right');assert.ok((await canonical('c')).includes('/uploaded/'));assert.equal(await canonical('a'),image);assert.equal(await canonical('b'),image);
    await sectionImage('c');await remove();await save();await completed();await reloadPage();await wait(200);await ready();
    assert.equal(await storedLayout('c'),'image-right','Save/reload retains placement after image removal');assert.equal(await canonical('c'),'');assert.equal(await evaluate('!!document.querySelector('+JSON.stringify(preview('c'))+')'),false);
    await click('[aria-label="Select Section 2"]');assert.equal(await evaluate("document.querySelector('aside [aria-label=\"Image placement\"] [aria-pressed=true]').textContent.includes('Image Below')"),true);
    await fixture();await evaluate("Array.from(document.querySelectorAll('aside button')).find(button=>button.textContent.includes('Add Section')).click()");await wait(120);
    const newId=await evaluate('window.newsTest.sections().sections.at(-1).id');assert.equal(await storedLayout(newId),'image-above');assert.deepEqual(await choices(),[]);
    await browse('browse-a.png');assert.deepEqual(await choices(),allChoices);await placement('Image Left');await remove();assert.deepEqual(await choices(),[]);assert.equal(await storedLayout(newId),'image-left');await browse('browse-b.png');assert.deepEqual(await choices(),allChoices);assert.equal(await storedLayout(newId),'image-left');await reset();
    console.log('PASS four placement choices including staged uploads, new defaults, remove/re-add retention, legacy hidden-image/contained compatibility, layout switching with mounted editor and undo/redo');
    await fixture();await sectionImage('a');
    assert.equal(await img(),image);
    for(const [name,type,size,expected] of [['bad.txt','text/plain',10,'Invalid file type'],['bad.svg','image/png',10,'Invalid file extension'],['large.png','image/png',10485761,'Maximum size']]){
      await invalid(name,type,size);assert.equal(await evaluate('document.querySelector("aside").textContent.includes('+JSON.stringify(expected)+')'),true);assert.equal(await canonical('a'),image);assert.equal(await evaluate('window.uploadCalls.length'),0);
    }
    assert.equal(await evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled"),true,'invalid files do not dirty the form');
    await browse('browse-a.png');const firstBlob=await img();assert.ok(firstBlob.startsWith('blob:'));
    assert.equal(await canonical('a'),image,'staging leaves canonical URL persistent');
    assert.equal(await evaluate("JSON.stringify(window.newsTest.values().article_sections).includes('blob:')"),false);
    assert.equal(await evaluate('window.uploadCalls.length'),0,'uploads wait for Save');
    await browse('browse-b.png');assert.ok(await evaluate('window.revoked.includes('+JSON.stringify(firstBlob)+')'));
    const replacedBlob=await img();assert.notEqual(replacedBlob,firstBlob);
    await back();assert.equal(await evaluate("document.querySelector('[data-section-id=\"a\"] img').getAttribute('src')"),replacedBlob,'card thumbnail uses staged preview');
    assert.equal(await evaluate("document.querySelector('[data-news-preview-section=\"a\"] [data-news-target=\"image\"] img').getAttribute('src')"),replacedBlob,'inline image uses staged preview');
    await sectionImage('b');assert.equal(await canonical('b'),image);await sectionImage('a');assert.equal(await img(),replacedBlob,'selection round-trip retains draft');
    await remove();assert.equal(await canonical('a'),'');assert.equal(await evaluate('Object.keys(window.newsTest.drafts()).length'),0);assert.equal(await canonical('b'),image);
    await reset();await sectionImage('a');assert.equal(await img(),image);
    await drop('browse-a.png');assert.ok((await img()).startsWith('blob:'));await reset();await sectionImage('a');assert.equal(await img(),image);
    console.log('PASS native browse chooser, OS-file drop, replace/remove, validation, staged thumbnails/preview, Reset, independent sections and draft URL cleanup');
    await evaluate("void(window.editorBeforeUpload=window.newsEditors.get('a'));window.editorBeforeUpload.commands.insertContent(' staged body edit');void(window.bodyBeforeUpload=window.editorBeforeUpload.getJSON());");
    await browse('browse-a.png');await heldUpload();assert.equal(await evaluate("document.querySelector('aside [aria-busy]').getAttribute('aria-busy')"),'true');
    await sectionImage('b');await evaluate("window.newsTest.reorder('a','c')");await wait(70);await release();await completed();
    assert.deepEqual(await evaluate('window.lastSaved.article_sections.sections.map(s=>s.id)'),['b','c','a']);
    const persistentA=await evaluate('window.lastSaved.article_sections.sections.find(s=>s.id==="a").image');assert.ok(persistentA.includes('/uploaded/'));
    assert.deepEqual(await evaluate('window.lastSaved.article_sections.sections.find(s=>s.id==="a").body'),await evaluate('window.bodyBeforeUpload'));
    assert.equal(await evaluate('window.newsEditors.get("a")===window.editorBeforeUpload && window.editorBeforeUpload.can().undo()'),true,'uploads preserve editor instance and history');
    assert.equal(await evaluate('window.lastSaved.image'),image);assert.equal(await evaluate('window.lastSaved.article_sections.sections.find(s=>s.id==="b").image'),image);
    assert.equal(await evaluate('JSON.stringify(window.lastSaved.article_sections).includes("blob:")'),false);
    assert.equal(await evaluate('window.uploadCalls[0].isFile && window.uploadCalls[0].size>0 && window.uploadCalls[0].fileName.endsWith(".png")'),true);
    assert.equal(await evaluate('Object.keys(window.newsTest.drafts()).length'),0);
    await reloadPage();await wait(200);await ready();assert.equal(await canonical('a'),persistentA);await sectionImage('a');assert.equal(await img(),persistentA);await waitFor("document.querySelector('aside img')?.naturalWidth>0",'Saved image did not render');
    console.log('PASS Save resolves the File to a persistent URL, switching/reordering while upload is pending stays ID-bound, mock database reload restores it, cover unchanged');
    await fixture();await sectionImage('a');await browse('browse-a.png');await evaluate('window.failUpload=true');await save();
    await waitFor("document.querySelector('aside').textContent.includes('Fixture storage failure')",'Missing upload error');assert.ok((await img()).startsWith('blob:'));assert.equal(await evaluate('window.saveCalls.length'),0);
    await evaluate('window.failUpload=false');await save();await completed();
    await sectionImage('a');await browse('browse-b.png');await evaluate('window.failSave=true');await save();await waitFor("document.querySelector('aside').textContent.includes('Fixture database failure')",'Missing database error');
    const uploadsBeforeRetry=await evaluate('window.uploadCalls.length');await evaluate('window.failSave=false');await save();await completed();assert.equal(await evaluate('window.uploadCalls.length'),uploadsBeforeRetry,'database retry reuses successful uploaded URL');
    await sectionImage('a');await remove();await save();await completed();assert.equal(await evaluate('window.lastSaved.article_sections.sections.find(s=>s.id==="a").image'),'');assert.equal(await evaluate('window.lastSaved.image'),image);
    console.log('PASS storage/database errors retain drafts, retry succeeds without duplicate upload, removal persists independently');
    await fixture();await sectionImage('a');await browse('browse-a.png');await heldUpload();await evaluate("window.newsTest.remove('a')");await release();await completed();
    assert.deepEqual(await evaluate('window.lastSaved.article_sections.sections.map(s=>s.id)'),['b','c']);assert.equal(await evaluate('window.lastSaved.image'),image);
    await fixture();await sectionImage('a');await browse('browse-a.png');await heldUpload();await evaluate("window.newsTest.stage('a',null)");await release();await completed();assert.equal(await evaluate('window.lastSaved.article_sections.sections.find(s=>s.id==="a").image'),'');
    await fixture();await sectionImage('a');await browse('browse-a.png');await heldUpload();await evaluate("window.newsTest.stage('a',new File(['replacement'],'newer.png',{type:'image/png'}))");await release();
    await waitFor("document.querySelector('aside').textContent.includes('Section images changed while saving')",'Missing stale-replacement feedback');assert.equal(await evaluate('window.saveCalls.length'),0);assert.equal(await canonical('a'),image);
    await save();await completed();assert.equal(await evaluate('window.uploadCalls[1].name'),'newer.png');
    console.log('PASS section deletion, image removal and replacement during an upload never apply stale results or resurrect a target');
    await fixture();await sectionImage('a');await browse('browse-a.png');await heldUpload();await evaluate('window.newsTest.reset()');await release();await wait(120);assert.equal(await evaluate('window.saveCalls.length'),0);assert.equal(await canonical('a'),image);
    await fixture();await sectionImage('a');await browse('browse-a.png');await heldUpload();await evaluate("window.fixtureNavigate('other')");await waitFor("document.querySelector('#news-title')?.value==='Other article'",'Article switch failed');await release();await wait(120);
    assert.equal(await evaluate('window.saveCalls.length'),0);assert.equal(await evaluate("window.newsTest.sections().sections[0].id"),'other-a');assert.equal(await evaluate('Object.keys(window.newsTest.drafts()).length'),0);
    console.log('PASS Reset/navigation invalidates pending uploads; no old save or image is applied to the next article');
    // Observe the real page callback and drive external content props through its
    // React setter. Editor creation, subscriptions and cleanup remain production code.
    const clean = () => evaluate("document.querySelector('header button:has(svg.lucide-save)').disabled");
    const lifecycleSnapshot = () => evaluate('({sections:window.newsTest.sections(),updates:window.newsSectionUpdates})');
    const typeInSection = async (id,text) => {
      await click(sectionBody(id));await evaluate('window.newsEditors.get('+JSON.stringify(id)+').commands.focus("end")');await wait(70);
      await call('Input.insertText',{text});await wait(70);
    };
    await t.test('schema-equivalent JSON never replaces the document, while real mark changes synchronize with rich structure intact',async()=>{
      const article=structuredClone(initialArticle);
      article.article_sections.sections[0].body={type:'doc',content:[
        {type:'paragraph',content:[{type:'text',text:'  Bold ',marks:[{type:'bold'}]},{type:'text',text:'and italic',marks:[{type:'italic'}]},{type:'hardBreak'},{type:'text',text:' then both  ',marks:[{type:'bold'},{type:'italic'}]}]},
        {type:'paragraph'},
        {type:'paragraph',content:[{type:'text',text:'Final  paragraph.'}]},
      ]};
      await fixture(article);await click(sectionBody('a'));
      const canonical=await evaluate('window.newsEditors.get("a").getJSON()');
      // Reverse the root key order and express the same blank paragraph as [].
      const equivalent={content:structuredClone(canonical.content),type:'doc'};equivalent.content[1].content=[];
      await evaluate('window.equalityEditor=window.newsEditors.get("a");window.syncDocumentChanges=0;window.equalityEditor.on("transaction",({transaction})=>{if(transaction.docChanged)window.syncDocumentChanges++;});void 0;');
      const synchronized=await evaluate('window.newsTest.sections()');synchronized.sections[0].body=equivalent;
      await evaluate('window.newsTest.syncSections('+JSON.stringify(synchronized)+')');await wait(100);
      assert.equal(await evaluate('window.syncDocumentChanges'),0,'equivalent props cause no document-changing transaction');
      assert.equal(await evaluate('window.equalityEditor.can().undo() || window.equalityEditor.can().redo()'),false);
      assert.deepEqual(await evaluate('window.equalityEditor.getJSON()'),canonical);assert.deepEqual(await evaluate('window.newsSectionUpdates'),[]);assert.equal(await clean(),true);
      const changed=structuredClone(canonical);changed.content[0].content[0].marks.push({type:'italic'});synchronized.sections[0].body=changed;
      await evaluate('window.newsTest.syncSections('+JSON.stringify(synchronized)+')');
      await waitFor('window.equalityEditor.getJSON().content[0].content[0].marks.length===2','A real formatting-only change did not synchronize');
      assert.deepEqual(await evaluate('window.equalityEditor.getJSON()'),changed,'spaces, hard breaks, marks and empty paragraphs survive synchronization');
      assert.equal(await evaluate('window.syncDocumentChanges'),1);assert.equal(await evaluate('window.newsEditors.get("a")===window.equalityEditor'),true);
      assert.deepEqual(await evaluate('window.newsSectionUpdates'),[]);assert.equal(await clean(),true);
    });
    await t.test('malformed and unsupported external content retains the existing quiet empty-document fallback',async()=>{
      await fixture();await click(sectionBody('a'));
      for(const input of [{type:'doc',content:[{type:'unsupported-block'}]},{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:''}]}]},{type:'unsupported'},null]){
        const synchronized=await evaluate('window.newsTest.sections()');synchronized.sections[0].body=input;
        await evaluate('window.newsTest.syncSections('+JSON.stringify(synchronized)+')');await wait(100);
        assert.deepEqual(await evaluate('window.newsEditors.get("a").getJSON()'),{type:'doc',content:[{type:'paragraph'}]});
        assert.deepEqual(await evaluate('window.newsSectionUpdates'),[]);assert.equal(await clean(),true);
      }
    });
    await t.test('external section synchronization is quiet and subsequent user callbacks retain the correct article and section',async()=>{
      await fixture();await click(sectionBody('a'));
      assert.equal(await clean(),true);assert.deepEqual(await evaluate('window.newsSectionUpdates'),[],'loading and selection emit no user edits');
      const synchronized=await evaluate('window.newsTest.sections()');synchronized.sections[0].body=body('Externally synchronized section');
      await evaluate('window.syncEditor=window.newsEditors.get("a");window.newsTest.syncSections('+JSON.stringify(synchronized)+')');
      await waitFor('window.newsEditors.get("a").state.doc.textContent==="Externally synchronized section"','External content did not synchronize');
      assert.deepEqual(await evaluate('window.newsEditors.get("a").getJSON()'),synchronized.sections[0].body,'compare document structure without depending on JSON property order');
      assert.equal(await evaluate('window.newsEditors.get("a")===window.syncEditor'),true);
      assert.equal(await clean(),true,'prop synchronization does not dirty the form');assert.deepEqual(await evaluate('window.newsSectionUpdates'),[]);
      await typeInSection('a',' after synchronization');
      const updates=await evaluate('window.newsSectionUpdates');assert.equal(updates.length,1);assert.equal(updates[0].articleId,'fixture');assert.equal(updates[0].sectionId,'a');
      assert.deepEqual(updates[0].body,await bodyValue('a'));assert.deepEqual(await bodyValue('b'),initialArticle.article_sections.sections[1].body);
      assert.equal(await clean(),false,'a real user edit still dirties the synchronized section');
    });
    await t.test('section switching preserves independent Undo and Redo, including edits after stable-ID reordering',async()=>{
      await fixture();await typeInSection('a',' history A');const editedA=await bodyValue('a');
      await typeInSection('b',' history B');const editedB=await bodyValue('b');
      await evaluate('window.historyA=window.newsEditors.get("a");window.historyB=window.newsEditors.get("b");void 0;');
      await click(sectionBody('a'));assert.equal(await evaluate('window.historyA.commands.undo()'),true);await wait(70);
      assert.deepEqual(await bodyValue('a'),initialArticle.article_sections.sections[0].body);assert.deepEqual(await bodyValue('b'),editedB);
      assert.equal(await evaluate('window.historyB.can().undo() && !window.historyB.can().redo()'),true,'Undo in A leaves B history untouched');
      assert.equal(await evaluate('window.historyA.commands.redo()'),true);await wait(70);assert.deepEqual(await bodyValue('a'),editedA);
      await click(sectionBody('b'));assert.equal(await evaluate('window.historyB.commands.undo()'),true);await wait(70);
      assert.deepEqual(await bodyValue('b'),initialArticle.article_sections.sections[1].body);assert.deepEqual(await bodyValue('a'),editedA);
      assert.equal(await evaluate('window.historyA.can().undo() && !window.historyA.can().redo()'),true,'Undo in B leaves A history untouched');
      await evaluate('window.historyB.commands.redo();window.newsTest.reorder("b","a")');await wait(100);
      assert.deepEqual(await evaluate('window.newsTest.sections().sections.map(section=>section.id)'),['b','a','c']);
      await typeInSection('b',' after reorder');
      assert.equal(await evaluate('window.newsEditors.get("a")===window.historyA && window.newsEditors.get("b")===window.historyB'),true);
      assert.ok(JSON.stringify(await bodyValue('b')).includes('history B after reorder'));
      assert.deepEqual(await bodyValue('a'),editedA);assert.deepEqual(await bodyValue('c'),initialArticle.article_sections.sections[2].body);
      assert.equal(await evaluate('window.newsSectionUpdates.at(-1).sectionId'),'b');
    });
    await t.test('Reset destroys discarded history and republishes a usable editor even with unchanged saved ID and body',async()=>{
      await fixture();await typeInSection('a',' discarded A');await typeInSection('b',' discarded B');
      await evaluate('window.beforeResetEditors=[...window.newsEditors.values()];void 0;');
      assert.equal(await evaluate('window.beforeResetEditors.every(editor=>editor.can().undo())'),true);
      await reset();assert.deepEqual(await evaluate('window.newsTest.sections()'),initialArticle.article_sections);
      assert.equal(await evaluate('window.beforeResetEditors.every(editor=>editor.isDestroyed)'),true);
      const resetHistory=await evaluate(`Array.from(window.newsEditors,([id,editor])=>{
        const saved=window.newsTest.sections().sections.find(section=>section.id===id).body;
        return {id,undo:editor.can().undo(),redo:editor.can().redo(),sameDocument:editor.state.doc.eq(editor.schema.nodeFromJSON(saved)),sameJSONOrder:JSON.stringify(editor.getJSON())===JSON.stringify(saved)};
      })`);
      const resetState=await lifecycleSnapshot();
      for(const id of ['a','b']){
        await click(sectionBody(id));await evaluate('window.newsEditors.get('+JSON.stringify(id)+').commands.focus("end")');await wait(70);
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:2});
        await call('Input.dispatchKeyEvent',{type:'keyUp',key:'z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:2});await wait(70);
      }
      const afterUndo=await lifecycleSnapshot();const cleanAfterUndo=await clean();
      assert.deepEqual(afterUndo.sections.sections,resetState.sections.sections,'native Undo must not recover discarded section content');
      await click(sectionBody('a'));await evaluate('window.unchangedBodyEditor=window.newsEditors.get("a");void 0;');
      await editInput('#section-heading','Discard only a heading change');await reset();
      assert.equal(await evaluate('window.unchangedBodyEditor.isDestroyed && window.newsEditors.get("a")!==window.unchangedBodyEditor'),true);
      await typeInSection('a',' usable after Reset');
      assert.ok(JSON.stringify(await bodyValue('a')).includes('usable after Reset'));assert.equal(await evaluate('window.newsSectionUpdates.at(-1).sectionId'),'a');
      const typedAfterReset=await bodyValue('a');
      assert.equal(await evaluate('window.newsEditors.get("a").commands.undo()'),true);await wait(70);
      assert.deepEqual(await bodyValue('a'),initialArticle.article_sections.sections[0].body,'new typing can be undone to the saved body');
      assert.equal(await evaluate('window.newsEditors.get("a").can().undo()'),false,'Undo stops at the Reset boundary');
      assert.equal(await evaluate('window.newsEditors.get("a").commands.redo()'),true);await wait(70);
      assert.deepEqual(await bodyValue('a'),typedAfterReset,'Redo restores the legitimate edit made after Reset');
      await evaluate('window.newsEditors.get("a").commands.setTextSelection({from:1,to:6})');await nativeClick('aside [aria-label="Italic"]');
      assert.deepEqual((await bodyValue('a')).content[0].content[0].marks.map(mark=>mark.type).sort(),['bold','italic'],'the republished editor also formats the saved text');
      assert.deepEqual(await bodyValue('b'),initialArticle.article_sections.sections[1].body);
      assert.ok(resetHistory.every(editor=>!editor.undo && !editor.redo),'Reset must start with empty history: '+JSON.stringify({resetHistory,updatesAfterNativeUndo:afterUndo.updates.length-resetState.updates.length,cleanAfterUndo}));
      assert.deepEqual(afterUndo,resetState,'native Ctrl+Z cannot emit an edit after Reset');assert.equal(cleanAfterUndo,true);
    });
    await t.test('article changes destroy owned editors and isolate content and callbacks even when section IDs collide',async()=>{
      await fixture();await typeInSection('a',' unsaved article A');await typeInSection('b',' unsaved article B');
      const other={...initialArticle,id:'other',title:'Other article',slug:'other-article',article_sections:{...initialArticle.article_sections,sections:[{...initialArticle.article_sections.sections[0],body:body('Different article content')}]}};
      await evaluate('window.articleEditors=[...window.newsEditors.values()];window.otherNewsFixture='+JSON.stringify(other)+';void 0;');
      const updatesBefore=await evaluate('window.newsSectionUpdates.length');await evaluate('window.fixtureNavigate("other")');
      await waitFor('document.querySelector("#news-title")?.value==="Other article" && window.newsEditors.get("a") && !window.articleEditors.includes(window.newsEditors.get("a")) && !window.newsEditors.get("a").isDestroyed','Article switch did not publish a fresh editor');
      assert.equal(await evaluate('window.articleEditors.every(editor=>editor.isDestroyed)'),true);
      assert.deepEqual(await evaluate('[...window.newsEditors.keys()]'),['a']);assert.deepEqual(await bodyValue('a'),other.article_sections.sections[0].body);
      assert.equal(await evaluate('window.newsSectionUpdates.length'),updatesBefore,'article loading emits no user update');assert.equal(await clean(),true);
      const loaded=await lifecycleSnapshot();await evaluate('window.articleEditors.forEach(editor=>editor.emit("update",{editor}))');await wait(70);
      assert.deepEqual(await lifecycleSnapshot(),loaded,'old editors cannot update a new article with the same section ID');
      await typeInSection('a',' current article edit');const currentUpdate=await evaluate('window.newsSectionUpdates.at(-1)');
      assert.equal(currentUpdate.articleId,'other');assert.equal(currentUpdate.sectionId,'a');assert.deepEqual(currentUpdate.body,await bodyValue('a'));
      await evaluate('window.otherEditor=window.newsEditors.get("a");window.fixtureNavigate("fixture")');
      await waitFor('document.querySelector("#news-title")?.value==="Inspector fixture" && window.newsEditors.get("a") && window.newsEditors.get("a")!==window.otherEditor && !window.newsEditors.get("a").isDestroyed','Returning article did not reload a fresh editor');
      assert.equal(await evaluate('window.otherEditor.isDestroyed'),true);
      assert.deepEqual(await evaluate('window.newsTest.sections()'),initialArticle.article_sections,'returning loads saved content, not the old unsaved edits');assert.equal(await clean(),true);
      const returned=await lifecycleSnapshot();await evaluate('window.otherEditor.emit("update",{editor:window.otherEditor});delete window.otherNewsFixture');await wait(70);
      assert.deepEqual(await lifecycleSnapshot(),returned);
    });
    await t.test('unmount destroys all owned editors and detaches their update callbacks',async()=>{
      await fixture();await click(sectionBody('b'));await evaluate('window.unmountEditors=[...window.newsEditors.values()];void 0;');
      assert.equal(await evaluate('window.unmountEditors.length'),2);
      const before=await lifecycleSnapshot();await evaluate('window.unmountNewsFixture()');await wait(70);
      assert.equal(await evaluate('window.newsEditors.size===0 && window.unmountEditors.every(editor=>editor.isDestroyed) && document.querySelector("#app").childElementCount===0'),true);
      await evaluate('window.unmountEditors.forEach(editor=>editor.emit("update",{editor}))');await wait(70);
      assert.deepEqual(await lifecycleSnapshot(),before,'destroyed editors retain no page update subscriptions after unmount');
    });
    assert.equal(exceptions.length,0,exceptions.join('\n'));

  } finally { if(socket)socket.close(); browser.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
}
require('node:test').test('News section images stage, validate, save, reload and ignore stale uploads', { timeout: 120000, skip: chrome ? false : 'Set CHROME_PATH to Chromium to run the browser fixture.' }, main);
