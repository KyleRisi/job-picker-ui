const { chromium } = require('playwright');
const BASE = 'https://www.thecompendiumpodcast.com';
function parseData(raw){if(!raw) return null; for (const t of [raw, (()=>{try{return Buffer.from(raw,'base64').toString('utf8')}catch{return ''}})()]){ if(!t) continue; try{return JSON.parse(t)}catch{}} return null;}
function decode(call){const out=[]; const p=[]; if(call.body){const q=new URLSearchParams(call.body); if(q.get('data')) p.push(q.get('data'));} try{const u=new URL(call.url); if(u.searchParams.get('data')) p.push(u.searchParams.get('data'));}catch{} for(const c of p){const x=parseData(c); if(Array.isArray(x)) x.forEach(e=>e?.event&&out.push(e.event)); else if(x?.event) out.push(x.event);} return out;}
(async()=>{const browser=await chromium.launch({headless:true}); const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.addInitScript(()=>{window.__mp=[]; const o1=XMLHttpRequest.prototype.open,o2=XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.open=function(m,u,...r){this.__u=String(u||''); return o1.call(this,m,u,...r)}; XMLHttpRequest.prototype.send=function(b){try{if((this.__u||'').includes('mixpanel')) window.__mp.push({url:this.__u, body: typeof b==='string'?b:''})}catch{} return o2.call(this,b)};});
const page=await context.newPage(); const wait=(ms)=>page.waitForTimeout(ms);
await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await wait(3500);
await page.evaluate(()=>{document.addEventListener('click',(e)=>{const a=e.target instanceof Element?e.target.closest('a[href]'):null; if(a && (a.getAttribute('href')||'').startsWith('/')) e.preventDefault();},true);});
await page.getByRole('button',{name:'Listen Now'}).first().click(); await wait(2500);
await page.getByRole('link',{name:/Listen on Spotify/i}).first().click({force:true}); await wait(4500);
await page.locator('[data-homepage-v2-event="homepage_reviews_click"]').first().click({force:true}); await wait(9000);
const calls=await page.evaluate(()=>window.__mp||[]); await browser.close(); const events=[...new Set(calls.flatMap(decode))].sort(); console.log(JSON.stringify({callsCount:calls.length,events},null,2));})();
