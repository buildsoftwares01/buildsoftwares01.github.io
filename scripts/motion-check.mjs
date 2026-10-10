import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  // Sample the actual CSS timeline to verify left-to-right writing, not just its final appearance.
  const samples = await page.locator('.name-stroke').evaluateAll(paths => {
    const animations = paths.map(path => path.getAnimations()[0]);
    animations.forEach(animation => animation.pause());
    const result = [];
    for (const time of [0, 1500, 2900, 3600, 4700, 5300]) {
      animations.forEach(animation => { animation.currentTime = time; });
      result.push(paths.map(path => parseFloat(getComputedStyle(path).strokeDashoffset)));
    }
    animations.forEach(animation => animation.finish());
    return result;
  });
  assert(samples[0].every(offset => offset === 1), 'Opening starts with unwritten lettering');
  assert.equal(samples[1][0], 0, 'V finishes before the following letters');
  assert(samples[1].slice(3).every(offset => offset === 1), 'Later letters wait for their turn');
  assert(samples[2][3] === 0 && samples[2][4] > 0 && samples[2][5] === 1, 'First a follows h');
  assert(samples[3][4] === 0 && samples[3][5] > 0 && samples[3][6] === 1, 'Second a follows the first a');
  assert(samples[4][6] === 0 && samples[4][7] > 0, 'Flourish follows the whole name');
  assert(samples[5].every(offset => offset === 0), 'Completed name remains readable');
  await page.locator('#replay-writing').click({ force: true });
  assert(parseFloat(await page.locator('.stroke-n').evaluate(el => getComputedStyle(el).strokeDashoffset)) > .99, 'Replay restarts the lettering');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  assert(await page.locator('.name-stroke').evaluateAll(paths => paths.every(path => parseFloat(getComputedStyle(path).strokeDashoffset) === 0)), 'Pausing shows the complete name');
  assert(await page.locator('#replay-writing').isDisabled());
  assert(await page.locator('.opening-button').isVisible());
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await page.locator('.opening-button').click();
  await page.waitForFunction(() => document.querySelector('.hero .safari-home')?.dataset.painted === 'true');
  assert.equal(await page.locator('#hero-title em,.word-accent').evaluateAll(words => words.filter(word => getComputedStyle(word).animationName !== 'none').length), 0, 'Reading text stays still');
  const friend = page.locator('.hero .safari-friend');
  await friend.focus();
  await page.keyboard.press('Enter');
  assert.equal(await friend.getAttribute('data-gesture'), 'hello', 'Animal greeting works by keyboard');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  const pausedPose = await friend.locator('canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(200);
  assert.equal(await friend.locator('canvas').evaluate(canvas => canvas.toDataURL()), pausedPose, 'Canvas movement stops while paused');
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await page.locator('.section-nav a[href="#rsvp"]').click();
  await page.locator('#rsvp-button').click();
  await page.waitForFunction(() => document.body.classList.contains('motion-dialog'));
  assert.equal(await page.locator('#rsvp .safari-stop').getAttribute('data-paused'), 'true', 'Dialog pauses animal movement');
  await page.locator('#close-rsvp').click();
  await page.waitForFunction(() => !document.body.classList.contains('motion-dialog'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  await page.locator('.section-nav a[href="#main"]').click();
  assert(await page.locator('.name-stroke').evaluateAll(paths => paths.every(path => parseFloat(getComputedStyle(path).strokeDashoffset) === 0)), 'Reduced motion shows the entire name immediately');
  assert(await page.locator('#motion-toggle').isDisabled());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
  assert.deepEqual(errors, []);
  console.log('Left-to-right handwriting, replay, complete paused lettering, stable reading text, keyboard greetings, reduced motion and dialog motion passed.');
} finally { await browser.close(); }
