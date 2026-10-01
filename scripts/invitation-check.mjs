import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { readFile } from 'node:fs/promises';
import { event } from '../event-config.js';
import { getEventDate } from '../event-details.js';
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const cases = [
  { name: 'confirmed party details', event, actual: true },
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
   if (!test.actual && url.pathname==='/event-config.js') return route.fulfill({contentType:'text/javascript',body:`export const event = ${JSON.stringify(test.event)};`});
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
   assert.match(await page.locator('#event-time').textContent(),new RegExp(test.event.time));
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
   assert.equal(url.pathname,`/${test.event.whatsappNumber}`);
   assert(url.searchParams.get('text').includes(guest));
   assert(url.searchParams.get('text').includes('3 guests'));
   assert.equal(await page.evaluate(()=>localStorage.length),0);
  }
  await page.locator('#close-rsvp').tap();
  if(test.event.date) {
   for (const button of await page.locator('[data-calendar]').all()) {
    const downloadPromise=page.waitForEvent('download');
    await button.tap();
    const download=await downloadPromise;
    const ics=await readFile(await download.path(),'utf8');
    const start=getEventDate(test.event).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    assert(ics.includes(`DTSTART:${start}`),'Calendar uses Mauritius UTC+04:00');
    assert(ics.includes('LOCATION:Paps'));
    assert(!ics.includes('DTEND'),'No fabricated ending time');
   }
  }
  assert.equal(await page.locator('#share-button').count(),0);
  assert.deepEqual(blocked,[],'No external requests');
  assert.deepEqual(errors,[],'No runtime errors');
  console.log(`${test.name}: RSVP, calendar and privacy passed`);
  await context.close();
 }
} finally { await browser.close(); }
