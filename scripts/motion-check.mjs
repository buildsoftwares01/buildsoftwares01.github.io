import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
  assert.equal(await page.locator('h1 em,.word-accent').evaluateAll(words => words.filter(word => word.hasAttribute('role') || word.tabIndex >= 0).length), 0, 'Reading text stays out of the tab order');
  assert.equal(await page.locator('h1 em,.one>span,.word-accent').evaluateAll(words => words.filter(word => getComputedStyle(word).animationName !== 'none').length), 0, 'Reading text stays still');
  await page.locator('.site-header .section-nav').getByRole('link', {name:'Kids corner', exact:true}).click();
  await page.locator('#kids-corner').getByRole('button', {name:'Wave with lion cub', exact:true}).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#kids-corner .safari-friend').first().getAttribute('data-gesture'), 'hello', 'Animal greeting works by keyboard');
  assert.equal(await page.locator('.accent-comic-burst').count(), 0, 'No comic burst covers reading text');
  await page.getByRole('button', {name:'Pause animations', exact:true}).click();
  assert(await page.locator('body').evaluate(body => body.classList.contains('motion-paused')));
  const pausedPose = await page.locator('#kids-corner .safari-canvas').first().evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#kids-corner .safari-canvas').first().evaluate(canvas => canvas.toDataURL()), pausedPose, 'Canvas movement stops while paused');
  assert.equal(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.getByRole('button', {name:'Resume animations', exact:true}).click();
  await page.locator('.safari-friend[data-gesture]').waitFor({state:'detached'});
  await page.locator('.site-header [data-rsvp]').click();
  await page.waitForFunction(() => document.body.classList.contains('motion-dialog'));
  assert.equal(await page.locator('.safari-stop').first().getAttribute('data-paused'), 'true', 'Dialog pauses animal movement');
  await page.locator('#close-rsvp').click();
  await page.waitForFunction(() => !document.body.classList.contains('motion-dialog'));
  await page.locator('.brand').first().click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: no horizontal overflow`);
    // Sample the entire loop: every phrase must be fully visible at some point.
    const phrasesSeen = await page.locator('.ticker-track').evaluate(track => {
      const animation = track.getAnimations()[0];
      animation.pause();
      const windowRect = track.parentElement.getBoundingClientRect();
      const phrases = [...track.firstElementChild.querySelectorAll('span')];
      const seen = new Set();
      for (let time = 0; time < 34000; time += 100) {
        animation.currentTime = time;
        phrases.forEach((phrase, index) => {
          const rect = phrase.getBoundingClientRect();
          if (rect.left >= windowRect.left && rect.right <= windowRect.right) seen.add(index);
        });
      }
      animation.currentTime = 0;
      animation.play();
      return seen.size;
    });
    assert.equal(phrasesSeen, 4, `${width}px: every ribbon phrase scrolls into view`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.body.classList.contains('motion-paused'));
  assert.equal(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion stops the ribbon');
  assert(await page.locator('#motion-toggle').isDisabled());
  const stillPose = await page.locator('#kids-corner .safari-canvas').first().evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#kids-corner .safari-canvas').first().evaluate(canvas => canvas.toDataURL()), stillPose, 'Reduced motion stops canvas loops');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: paused ribbon has no overflow`);
    assert(await page.locator('.ticker-group').first().locator('span').evaluateAll(phrases => phrases.every(phrase => {
      const box = phrase.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth;
    })), `${width}px: every paused phrase is readable`);
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(() => !document.body.classList.contains('motion-paused'));
  assert.equal(await page.locator('.ticker-track').evaluate(el => getComputedStyle(el).animationName), 'ribbon-scroll', 'Changing device preference resumes decorations');
  for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
    const preview = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await preview.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
    await preview.evaluate(() => document.fonts.ready);
    await preview.waitForFunction(() => [...document.querySelectorAll('.safari-home')].every(home => home.dataset.renderer === '2d'));
    await preview.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    await preview.screenshot({ path: `test-results/${name}-hero.png` });
    await preview.close();
  }
  assert.deepEqual(errors, []);
  console.log('Responsive layouts, steady reading text, keyboard greetings, pause/resume, reduced motion and dialog motion passed.');
} finally { await browser.close(); }
