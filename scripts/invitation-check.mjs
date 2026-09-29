import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const cases = [
  { name: 'pending details', event: { date:null, time:null, utcOffset:'+04:00', whatsappNumber:'', venue:'Paps Restaurant' } },
  { name: 'configured details', event: { date:'2026-12-06', time:'12:30', utcOffset:'+04:00', whatsappNumber:'23000000000', venue:'Paps Restaurant, Vacoas-Phoenix' } },
];
try {
 for (const test of cases) {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion:'reduce', acceptDownloads:true });
  const page = await context.newPage();
  const errors = [], blocked = [];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if (url.pathname==='/event-config.js') return route.fulfill({contentType:'text/javascript',body:`export const event = ${JSON.stringify(test.event)};`});
   if (url.origin!==base) { blocked.push(url.href); return route.abort(); }
   return route.continue();
  });
  // Test doubles: never contact WhatsApp or send any messages.
  await page.addInitScript(()=>{
   window.open=(url)=>{window.testOpenedURL=url;return null};
   Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.testCopiedText=text}},configurable:true});
  });
  await page.goto(base);
  await page.locator('#rsvp-button').tap();
  if (!test.event.whatsappNumber) {
   assert(await page.locator('#rsvp-unavailable').isVisible());
   assert.equal(await page.locator('#rsvp-form').isVisible(),false);
   assert.equal(await page.locator('#countdown').isVisible(),false);
  } else {
   assert.equal(await page.locator('#event-date').textContent(),'6 December 2026');
   assert.equal(await page.locator('#event-day').textContent(),'Sunday');
   assert.match(await page.locator('#event-time').textContent(),/12:30/);
   assert(await page.locator('#rsvp-form').isVisible());
   await page.locator('#guest-name').fill('   ');
   await page.locator('#rsvp-form button').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined);
   const guest = 'A & B <script>alert(1)</script> 🦁';
   await page.locator('#guest-name').fill(guest);
   await page.locator('#guest-count').selectOption('3');
   await page.locator('#rsvp-form button').tap();
   const url=new URL(await page.evaluate(()=>window.testOpenedURL));
   assert.equal(url.origin,'https://wa.me');
   assert.equal(url.pathname,'/23000000000');
   assert(url.searchParams.get('text').includes(guest));
   assert(url.searchParams.get('text').includes('3 guests'));
   assert.equal(await page.evaluate(()=>localStorage.length),0);
  }
  await page.locator('#close-rsvp').tap();
  if(test.event.date) {
   const downloadPromise=page.waitForEvent('download');
   await page.locator('#calendar-button').tap();
   const download=await downloadPromise;
   const ics=await readFile(await download.path(),'utf8');
   assert(ics.includes('DTSTART:20261206T083000Z'),'Calendar uses Mauritius UTC+04:00');
   assert(ics.includes('Paps Restaurant\\, Vacoas-Phoenix'));
   assert(!ics.includes('DTEND'),'No fabricated ending time');
  }
  await page.locator('#share-button').tap();
  assert.equal(await page.evaluate(()=>window.testCopiedText),base+'/');
  assert.deepEqual(blocked,[],'No external requests');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`${test.name}: RSVP, calendar, sharing and privacy passed`);
  await context.close();
 }
} finally { await browser.close(); }
