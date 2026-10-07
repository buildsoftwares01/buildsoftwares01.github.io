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
  assert.equal(await page.locator('#mobile-actions').isVisible(), false);
  assert.deepEqual(await page.locator('#main > section').evaluateAll(sections => sections.map(s => s.id || 'hero')), ['hero', 'celebration', 'venue', 'rsvp', 'games']);
  for (const trigger of await page.locator('[data-rsvp]:not(.mobile-actions button)').all()) {
   await trigger.tap();
   assert(await page.locator('#rsvp-dialog').isVisible());
   await page.locator('#close-rsvp').tap();
   assert(await trigger.evaluate(el => document.activeElement === el));
  }
  await page.locator('#games').scrollIntoViewIfNeeded();
  await page.locator('#mobile-actions').waitFor({state:'visible'});
  await page.locator('#mobile-actions [data-rsvp]').tap();
  assert(await page.locator('#rsvp-dialog').isVisible());
  if (!test.event.whatsappNumber) {
   assert(await page.locator('#rsvp-unavailable').isVisible());
   assert.equal(await page.locator('#rsvp-form').isVisible(),false);
   assert.equal(await page.locator('#countdown').isVisible(),false);
   assert.equal(await page.locator('#hero-date').textContent(), 'Date coming soon');
   assert.equal(await page.locator('#event-date').textContent(), 'Date coming soon');
   assert.equal(await page.locator('#event-time').textContent(), 'Time coming soon');
  } else {
   assert.equal(await page.locator('#event-date').textContent(),'6 December 2026');
   assert.equal(await page.locator('#event-day').textContent(),'Sunday');
   assert.match(await page.locator('#event-time').textContent(),new RegExp(test.event.time));
   assert(await page.locator('#rsvp-form').isVisible());
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   await page.locator('#guest-name').fill('   ');
   await page.locator('#guest-attendance').selectOption('yes');
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined);
   const guest = 'A & B <script>alert(1)</script> 🦁';
   await page.locator('#guest-name').fill(guest);
   await page.locator('#guest-count').selectOption('3');
   if (test.actual) await page.screenshot({path:'test-results/rsvp-accept.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   const url=new URL(await page.evaluate(()=>window.testOpenedURL));
   assert.equal(url.origin,'https://wa.me');
   assert.equal(url.pathname,`/${test.event.whatsappNumber}`);
   assert(url.searchParams.get('text').includes(guest));
   assert(url.searchParams.get('text').includes('3 guests'));
   assert((await page.locator('#rsvp-status').textContent()).includes('Send your message in WhatsApp'));
   assert(await page.locator('#rsvp-fallback').isVisible());
   assert.equal(await page.locator('#rsvp-message').inputValue(), url.searchParams.get('text'));
   await page.locator('#copy-rsvp').tap();
   assert.equal(await page.evaluate(() => window.testCopiedText), url.searchParams.get('text'));
   await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); }; });
   await page.locator('#copy-rsvp').tap();
   assert((await page.locator('#copy-status').textContent()).includes('Select and copy'));
   assert.equal(await page.evaluate(() => document.activeElement.id), 'rsvp-message');
   await page.locator('#guest-count').selectOption('6+');
   assert(await page.locator('#guest-total').isVisible());
   await page.locator('#guest-total').fill('5');
   await page.evaluate(()=>{window.testOpenedURL=undefined});
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert.equal(await page.evaluate(()=>window.testOpenedURL),undefined,'Reject an invalid larger-party count');
   await page.locator('#guest-total').fill('8');
   await page.locator('#rsvp-form button[type=submit]').tap();
   assert(new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text').includes('8 guests'),'Exact larger-party count reaches the message');
   await page.locator('#guest-attendance').selectOption('no');
   assert.equal(await page.locator('#guest-party').isVisible(),false);
   assert.equal(await page.locator('#rsvp-fallback').isVisible(),false,'Changing the answer clears the stale prepared reply');
   assert(await page.locator('#guest-total').isDisabled());
   if (test.actual) await page.screenshot({path:'test-results/rsvp-decline.png'});
   await page.locator('#rsvp-form button[type=submit]').tap();
   const decline = new URL(await page.evaluate(()=>window.testOpenedURL)).searchParams.get('text');
   assert(decline.includes(guest));
   assert(decline.includes("Sorry, we can't make it"));
   assert(!decline.includes('guests') && !decline.includes("We'd love to celebrate"),'Decline has no headcount or acceptance language');
   await page.locator('#guest-attendance').selectOption('yes');
   assert(await page.locator('#guest-total').isVisible(),'Switching back restores the exact count field');
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
  console.log(`${test.name}: acceptance, decline, headcounts, calendar and privacy passed`);
  await context.close();
 }
} finally { await browser.close(); }
