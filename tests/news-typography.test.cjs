// Browser fixtures use the real News components and editor; no backend writes.
// Run with: node --test tests/news-typography.test.cjs
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'goldentopper-news-typography-'));
const repoRequire = require('module').createRequire(path.join(root, 'package.json'));
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
const { webpack } = repoRequire('next/dist/compiled/webpack/webpack'), postcss = repoRequire('postcss'), tailwind = repoRequire('@tailwindcss/postcss');
const write = (name, value) => fs.writeFileSync(path.join(work, name), value);
// Alternate paragraphs and intentional blank lines, as found in older articles.
const saved = { id: 'saved-fixture', title: 'A saved article with intentional blank paragraphs', date: '2026-10-19', category: 'News', slug: 'saved-fixture', image: '', article_sections: { version: 1, createdAt: '2026-10-19', updatedAt: '2026-10-19', sections: [{ id: 'saved-section', layout: 'image-above', headingEnabled: false, order: 0, body: { type: 'doc', content: Array.from({ length: 29 }, (_, i) => ({ type: 'paragraph', content: i % 2 ? [] : [{ type: 'text', text: 'Saved paragraph ' + i + '. ' + ('The original paragraph structure must survive rendering. ').repeat(4) }] })) } }] } };
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#d0b370"/></svg>');
const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Words sit beside ' }, { type: 'text', text: 'bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' and ' }, { type: 'text', text: 'italic', marks: [{ type: 'italic' }] }, { type: 'text', text: ' and both', marks: [{ type: 'bold' }, { type: 'italic' }] }, { type: 'text', text: '. Two  intentional spaces remain. ' + ('A carefully written article keeps each sentence readable and every paragraph connected. ').repeat(4) }] }, { type: 'paragraph', content: [] }, { type: 'paragraph', content: [{ type: 'text', text: 'Before a soft break.' }, { type: 'hardBreak' }, { type: 'text', text: 'After the soft break.' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Final paragraph.' }] }, { type: 'paragraph', content: [] }] };
const base = { id: 'fixture', title: 'A closely connected article title', category: 'News', date: '2026-10-19', slug: 'spacing-fixture', excerpt: 'First legacy line.\nSecond legacy line.\n\nThird legacy line.', image: '', article_content: JSON.stringify(body), article_layout: 'image-above' };
write('loader.cjs', `const ts=require(${JSON.stringify(repoRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('link.jsx', 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}');
write('empty.jsx', 'import React from "react"; export default function Empty(){return null;}');
write('transition.jsx', 'import React from "react";export default function Transition({children}){return <>{children}</>;}');
write('image.jsx', 'import React from "react";export default function Image({fill,priority,sizes,...props}){return <img {...props}/>;}');
write('animation.js', 'export default {registerPlugin(){},ticker:{add(){},remove(){}},context(){return {revert(){}}},fromTo(){}};export const ScrollTrigger={update(){},refresh(){}};');
write('lenis.js', 'export default class Lenis{scrollTo(){}on(){}destroy(){}raf(){}}');
write('data.js', 'export const createClient=()=>({from:()=>({select(){return this},neq(){return this},is(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})})});');
write('entry.jsx', `
import React,{useRef,useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
import Preview from ${JSON.stringify(path.join(root, 'app/admin/news/PreviewSkeleton.tsx').replace(/\\/g, '/'))};
import Public from ${JSON.stringify(path.join(root, 'app/news&updates/[slug]/newsclient.tsx').replace(/\\/g, '/'))};
import {useSectionEditor,cleanupAllSectionEditors} from ${JSON.stringify(path.join(root, 'app/admin/news/useSectionEditor.ts').replace(/\\/g, '/'))};
import {adaptLegacyArticleToSections} from ${JSON.stringify(path.join(root, 'app/types/article-sections.ts').replace(/\\/g, '/'))};
import {parseArticleContent} from ${JSON.stringify(path.join(root, 'lib/rendering/article-content.ts').replace(/\\/g, '/'))};
window.newsSaved=${JSON.stringify(saved)};window.newsBase=${JSON.stringify(base)};window.newsBody=${JSON.stringify(body)};window.newsImage=${JSON.stringify(image)};
function Fixture({mode,article}){const doc=article.article_sections||adaptLegacyArticleToSections({...article,article_content:article.article_content?parseArticleContent(article.article_content):null});const section=doc.sections[0];const registry=useRef(new Map());const [value,setValue]=useState(section.body);const editor=useSectionEditor({sectionId:mode==='editable'?section.id:'',content:value,onChange:setValue,editorsRegistry:registry});useEffect(()=>()=>cleanupAllSectionEditors(registry),[]);useEffect(()=>{window.fixtureEditor=editor;},[editor]);return mode==='public'?<Public initialArticle={article}/>:<Preview data={{...article,article_sections:doc}} selectedRegion={mode==='editable'?'section-body':'overview'} selectedSectionId={mode==='editable'?section.id:null} sectionEditor={editor} onSelectRegion={()=>{}} onSelectSection={()=>{}}/>;}
const root=createRoot(document.getElementById('app'));let key=0;window.renderNewsFixture=(mode,layout='text-only',hasImage=false,heading=false,kind='formatted')=>{let article=kind==='saved'?window.newsSaved:{...window.newsBase};if(kind==='formatted')article.article_sections={version:1,createdAt:'2026-10-19',updatedAt:'2026-10-19',sections:[{id:'section-a',heading:typeof heading==='string'?heading:'A section heading',headingEnabled:!!heading,layout,body:window.newsBody,image:hasImage?window.newsImage:undefined,order:0}]};if(kind==='legacy'){article.article_content=null;article.excerpt=window.newsBase.excerpt;}root.render(<Fixture key={++key} mode={mode} article={article}/>);};window.renderNewsFixture('readonly');
`);
async function main() {
    await new Promise((resolve, reject) => webpack({ mode: 'development', context: root, entry: path.join(work, 'entry.jsx'), devtool: false, output: { path: work, filename: 'bundle.js' }, resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], modules: [path.join(root, 'node_modules'), 'node_modules'], alias: { '@/app/components/navbar': path.join(work, 'empty.jsx'), '@/app/components/footer': path.join(work, 'empty.jsx'), '@/app/components/backtotop': path.join(work, 'empty.jsx'), '@/app/components/page-transitions': path.join(work, 'transition.jsx'), '@/lib/supabase/client': path.join(work, 'data.js'), 'next/link': path.join(work, 'link.jsx'), 'next/image': path.join(work, 'image.jsx'), 'lenis': path.join(work, 'lenis.js'), 'gsap/ScrollTrigger': path.join(work, 'animation.js'), 'gsap': path.join(work, 'animation.js'), '@': root } }, module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(work, 'loader.cjs') }] } }, (e, stats) => e || stats.hasErrors() ? reject(e || Error(stats.toString({ all: false, errors: true }))) : resolve()));
    const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
    write('styles.css', css.css);
    const fontDir = path.join(root, '.next/static/chunks');
    const fontFiles = (fs.existsSync(fontDir) ? fs.readdirSync(fontDir) : []).filter(f => f.endsWith('.css') && fs.readFileSync(path.join(root, '.next/static/chunks', f), 'utf8').includes('--font-poppins'));
    write('index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fontFiles.map(f => '<link rel="stylesheet" href="/_next/static/chunks/' + f + '">').join('')}<link rel="stylesheet" href="/styles.css"></head><body class="font-sans" style="overflow-y:scroll"><div id="app"></div><script src="/bundle.js"></script></body></html>`);
    const server = http.createServer((req, res) => { const f = req.url.startsWith('/_next/') ? path.join(root, '.next', req.url.slice('/_next/'.length)) : path.join(work, req.url === '/' ? 'index.html' : path.basename(req.url)); if (!fs.existsSync(f)) {
        res.writeHead(404);
        res.end();
        return;
    } res.setHeader('Content-Type', f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.woff2') ? 'font/woff2' : 'text/html'); fs.createReadStream(f).pipe(res); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(work, 'chrome-profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let socket;
    try {
        const browserUrl = await new Promise((resolve, reject) => {
            let stderr = '';
            const timer = setTimeout(() => reject(new Error('Chrome debugging startup timeout')), 15000);
            browser.stderr.on('data', data => { stderr += data; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) {
                clearTimeout(timer);
                resolve(match[1]);
            } });
            browser.on('error', reject);
            browser.on('exit', code => reject(new Error(`Chrome exited: ${code} ${stderr.slice(-200)}`)));
        });
        socket = new WebSocket(browserUrl);
        await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('WebSocket startup timeout')), 10000); socket.onopen = () => { clearTimeout(timer); resolve(); }; socket.onerror = error => { clearTimeout(timer); reject(error); }; });
        let id = 0;
        const pending = new Map();
        const exceptions = [];
        socket.onmessage = event => {
            const message = JSON.parse(event.data);
            if (message.method === 'Runtime.exceptionThrown')
                exceptions.push(message.params.exceptionDetails.text + ' ' + (message.params.exceptionDetails.exception?.description || ''));
            if (message.id) {
                const task = pending.get(message.id);
                pending.delete(message.id);
                message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
            }
        };
        const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000); pending.set(key, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) })); });
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        const call = (method, params) => send(method, params, sessionId);
        const evaluate = async (expression) => {
            const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
            if (result.exceptionDetails)
                throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const size = async (width, height) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await wait(150); };
        await call('Runtime.enable');
        await size(1440, 900);
        await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
        console.log('Navigated to isolated local fixture.');
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await evaluate(`typeof window.renderNewsFixture === 'function'`))
                break;
            await wait(100);
        }
        await evaluate(`document.fonts.ready`);
        if (!await evaluate("typeof window.renderNewsFixture==='function'"))
            throw Error('Fixture startup: ' + JSON.stringify(exceptions));
        const font = await evaluate(`Array.from(document.styleSheets).flatMap(sheet=>{try{return Array.from(sheet.cssRules)}catch{return[]}}).filter(r=>r.type===CSSRule.FONT_FACE_RULE&&r.style.fontFamily.includes('Poppins')).map(r=>r.style.fontFamily)[0]`);
        if (font)
            await evaluate('document.documentElement.style.setProperty("--font-poppins",' + JSON.stringify(font) + ');document.fonts.ready');
        const render = async (mode, layout = 'text-only', image = false, heading = false, kind = 'formatted') => { await evaluate('window.renderNewsFixture(' + [mode, layout, image, heading, kind].map(v => JSON.stringify(v)).join(',') + ')'); await wait(100); await evaluate('document.fonts.ready'); };
        const originalBase = await evaluate('window.newsBase');
        for (const width of [1440, 375]) {
            await size(width, 900);
            for (const visibility of [undefined, null, true, false]) {
                await evaluate('window.newsBase=' + JSON.stringify({ ...originalBase, image, show_cover_on_article: visibility }));
                for (const mode of ['editable', 'readonly', 'public']) {
                    await render(mode, 'image-left', true, true);
                    const cover = await evaluate(`(() => {const header=document.querySelector('.news-article-header');return {
                      visible:!!document.querySelector('[data-news-cover]'),headerTop:Math.round(header.getBoundingClientRect().top+scrollY),
                      source:document.querySelector('[data-news-cover] img')?.getAttribute('src'),
                      sections:document.querySelectorAll('.news-section-media img').length,
                      affordance:document.querySelector('[aria-label="Edit article cover image"]')?getComputedStyle(document.querySelector('[aria-label="Edit article cover image"]')).position:null
                    };})()`);
                    assert.equal(cover.visible, visibility !== false, 'only explicit false hides existing covers');
                    assert.equal(cover.sections, 1, 'cover preference leaves section image visible');
                    assert.equal(cover.headerTop, visibility === false ? 0 : 900, 'hidden cover reserves no layout space');
                    if (visibility !== false) assert.equal(cover.source, image);
                    if (mode !== 'public' && visibility === false) assert.equal(cover.affordance, 'absolute', 'hidden preview retains a control outside article flow');
                }
            }
            await evaluate('window.newsBase=' + JSON.stringify(originalBase));
            for (const mode of ['editable', 'readonly', 'public']) {
                await render(mode);
                assert.equal(await evaluate("Math.round(document.querySelector('.news-article-header').getBoundingClientRect().top+scrollY)"), 0, 'missing image has no placeholder height');
            }
        }
        console.log('PASS cover default/explicit visibility, matching hidden layout, recovery affordance and independent section images in editable/read-only/public at desktop/mobile widths.');
        const measure = () => evaluate(`(()=>{const title=document.querySelector('.news-article-title');const body=document.querySelector('[data-news-target="body"]')||document.querySelector('.news-article-body')||document.querySelector('.prose');const ps=[...body.querySelectorAll('p')];const paragraph=ps[0];const heading=document.querySelector('h2');const cs=getComputedStyle(paragraph);return {titleGap:Math.round(paragraph.getBoundingClientRect().top-title.getBoundingClientRect().bottom),headingGap:heading?Math.round(paragraph.getBoundingClientRect().top-heading.getBoundingClientRect().bottom):null,bodyWidth:Math.round(body.getBoundingClientRect().width),paragraphWidth:Math.round(paragraph.getBoundingClientRect().width),paragraphs:ps.length,firstHeight:Math.round(paragraph.getBoundingClientRect().height),secondHeight:Math.round(ps[1]?.getBoundingClientRect().height||0),paragraphGap:Math.round(ps[1]?.getBoundingClientRect().top-paragraph.getBoundingClientRect().bottom||0),bodyHeight:Math.round(body.getBoundingClientRect().height),font:cs.fontFamily,fontSize:cs.fontSize,lineHeight:cs.lineHeight,align:cs.textAlign,whiteSpace:cs.whiteSpace,wordSpacing:cs.wordSpacing,text:ps.map(p=>p.textContent)}})()`);
        const windowSavedParagraphCount = saved.article_sections.sections[0].body.content.length;
        for (const width of [1440, 375]) {
            await size(width, 900);
            for (const kind of ['formatted', 'saved', 'legacy']) {
                const rows = [];
                for (const mode of ['editable', 'readonly', 'public']) {
                    await render(mode, 'text-only', false, false, kind);
                    const m = await measure();
                    rows.push({ mode, ...m });
                }
                const publicRow = rows.find(row => row.mode === 'public');
                for (const row of rows) {
                    for (const field of ['titleGap', 'headingGap', 'bodyWidth', 'paragraphWidth', 'paragraphs', 'firstHeight', 'secondHeight', 'paragraphGap', 'bodyHeight', 'fontSize', 'lineHeight', 'align', 'whiteSpace', 'wordSpacing'])
                        assert.equal(row[field], publicRow[field], kind + ' ' + width + ' ' + row.mode + ' ' + field);
                    assert.deepEqual(row.text, publicRow.text, 'text characters and blank paragraphs match');
                    assert.equal(row.titleGap, 24);
                }
                if (kind === 'formatted') {
                    assert.equal(publicRow.paragraphs, 5);
                    assert.equal(publicRow.text[0], body.content[0].content.map(node => node.text || '').join(''));
                    assert.equal(publicRow.text[1], '');
                    assert.ok(publicRow.text[0].includes('Two  intentional spaces remain.'));
                }
                if (kind === 'saved') {
                    assert.equal(publicRow.paragraphs, windowSavedParagraphCount);
                    assert.equal(publicRow.text.filter(text => !text).length, 14);
                }
                if (kind === 'legacy')
                    assert.deepEqual(publicRow.text, ['First legacy line.', 'Second legacy line.', 'Third legacy line.']);
            }
        }
        for (const width of [1440, 375]) {
            await size(width, 900);
            await render('public', 'image-above', false);
            const standardParagraph = await measure();
            for (const layout of ['image-above', 'image-below', 'image-contained', 'image-left', 'image-right', 'text-only'])
                for (const hasImage of [false, true])
                    for (const heading of [false, true, '   ']) {
                        const rows = [];
                        for (const mode of ['editable', 'readonly', 'public']) {
                            await render(mode, layout, hasImage, heading);
                            const row = await measure();
                            rows.push(row);
                            if (!hasImage || layout === 'text-only') {
                                assert.equal(row.paragraphWidth, standardParagraph.paragraphWidth, 'all image-free and legacy text-only sections use standard paragraph width');
                                assert.equal(await evaluate("document.querySelectorAll('section img').length"), 0, 'legacy hidden images and absent images reserve no media');
                            }
                            assert.equal(row.align, 'justify');
                            const ratios = await evaluate("[...document.querySelectorAll('section img')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{const r=el.getBoundingClientRect();return r.height/r.width})");
                            for (const ratio of ratios)
                                assert.ok(Math.abs(ratio - 180 / 320) < .01, 'image proportions unchanged');
                        }
                        for (const row of rows) {
                            for (const field of ['titleGap', 'headingGap', 'paragraphWidth', 'paragraphs', 'firstHeight', 'secondHeight', 'paragraphGap', 'bodyHeight', 'align', 'whiteSpace'])
                                assert.equal(row[field], rows[2][field], width + ' ' + layout + ' image=' + hasImage + ' heading=' + heading + ' ' + field);
                            assert.deepEqual(row.text, rows[2].text);
                            if (heading === true)
                                assert.equal(row.headingGap, 24);
                            else if (!hasImage)
                                assert.equal(row.titleGap, 24);
                        }
                    }
        }
        const landscapeImage = image;
        const portraitImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><rect width="180" height="320" fill="#d0b370"/></svg>');
        for (const width of [1440, 375]) {
            await size(width, 900);
            for (const [source, ratio] of [[landscapeImage, 180 / 320], [portraitImage, 320 / 180]]) {
                await evaluate('window.newsImage=' + JSON.stringify(source));
                for (const layout of ['image-above', 'image-below', 'image-left', 'image-right', 'image-contained']) {
                    for (const heading of [false, true]) {
                        for (const mode of ['editable', 'readonly', 'public']) {
                            await render(mode, layout, true, heading);
                            const geometry = await evaluate(`(() => {
                              const media=document.querySelector('.news-section-media');
                              const image=media.querySelector('img');
                              const text=document.querySelector('.news-section-text');
                              const layout=media.parentElement;
                              const rect=el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom,width:r.width,height:r.height,left:r.left}};
                              return {media:rect(media),image:rect(image),text:rect(text),layout:rect(layout),background:getComputedStyle(image.parentElement).backgroundColor,placement:layout.dataset.imagePlacement};
                            })()`);
                            assert.ok(Math.abs(geometry.image.height / geometry.image.width - ratio) < .01, 'entire portrait/landscape image keeps its proportions');
                            assert.ok(Math.abs(geometry.media.height - geometry.image.height) < 1, 'media wrapper does not stretch to text height');
                            assert.equal(geometry.background, 'rgba(0, 0, 0, 0)', 'media background blends with the article');
                            if (layout === 'image-left' || layout === 'image-right') {
                                if (width >= 768) {
                                    assert.ok(Math.abs(geometry.image.top - geometry.text.top) < 1, 'side image aligns with first visible heading/body');
                                    assert.ok(Math.abs(geometry.media.width / geometry.layout.width - .4) < .001, 'existing 40% media column retained');
                                    assert.equal(geometry.media.left < geometry.text.left, layout === 'image-left');
                                } else {
                                    assert.ok(Math.abs(geometry.text.top - geometry.image.bottom - 24) < 1, 'mobile side placements stack image first with established spacing');
                                }
                            } else if (layout === 'image-below' || layout === 'image-contained') {
                                assert.equal(geometry.placement, 'image-below');
                                assert.equal(geometry.media.width, geometry.text.width, 'legacy contained images use standard Below width');
                                assert.ok(Math.abs(geometry.media.top - geometry.text.bottom - 32) < 1, 'Below arrangement retained');
                            } else {
                                assert.ok(Math.abs(geometry.text.top - geometry.image.bottom - 32) < 1, 'Above arrangement retained');
                            }
                        }
                    }
                }
            }
        }
        console.log('PASS supported/legacy placements, uniform image-free paragraphs, portrait/landscape proportions, side alignment/backgrounds and mobile stacking across editable/read-only/public.');
        await render('editable');
        await evaluate('window.fixtureEditor.commands.focus("end")');
        await wait(100);
        const original = await evaluate('window.fixtureEditor.getJSON()');
        await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await wait(100);
        assert.equal(await evaluate('window.fixtureEditor.getJSON().content.length'), original.content.length + 1);
        await evaluate('window.fixtureEditor.commands.undo()');
        await wait(70);
        assert.deepEqual(await evaluate('window.fixtureEditor.getJSON()'), original);
        await evaluate('window.fixtureEditor.commands.focus("end")');
        await wait(100);
        await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
        await wait(100);
        const shifted = await evaluate('window.fixtureEditor.getJSON()');
        assert.equal(shifted.content.length, original.content.length);
        assert.equal(shifted.content.at(-1).content.at(-1).type, 'hardBreak');
        await evaluate('window.newsBody=window.fixtureEditor.getJSON()');
        const shiftedRows = [];
        for (const mode of ['editable', 'readonly', 'public']) {
            await render(mode);
            shiftedRows.push(await measure());
        }
        assert.equal(shiftedRows[0].bodyHeight, shiftedRows[1].bodyHeight, 'trailing Shift+Enter height matches read-only');
        assert.equal(shiftedRows[0].bodyHeight, shiftedRows[2].bodyHeight, 'trailing Shift+Enter height matches public');
        await evaluate("window.newsBody={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Legacy inline newline\\n'}]}]}");
        const newlineRows = [];
        for (const mode of ['editable', 'readonly', 'public']) {
            await render(mode);
            newlineRows.push(await measure());
        }
        assert.equal(newlineRows[0].bodyHeight, newlineRows[1].bodyHeight, 'terminal literal newline matches read-only');
        assert.equal(newlineRows[0].bodyHeight, newlineRows[2].bodyHeight, 'terminal literal newline matches public');
        console.log('PASS Enter creates a paragraph, Shift+Enter creates a hard break, undo restores document structure, intentional spaces/blank lines/marks remain intact.');
        assert.equal(exceptions.length, 0, exceptions.join('\n'));
    }
    finally {
        if (socket)
            socket.close();
        browser.kill();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
require('node:test').test('News typography matches editable, read-only and public rendering', { timeout: 180000, skip: chrome ? false : 'Set CHROME_PATH to Chromium to run the browser fixture.' }, main);
