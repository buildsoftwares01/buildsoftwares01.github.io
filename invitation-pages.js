// One invitation chapter at a time. Native anchors remain a readable fallback.
export function setupInvitationPages() {
  const pages = [...document.querySelectorAll('#main > [data-page]')];
  const hashes = ['#main', '#invitation', '#celebration', '#venue', '#rsvp', '#games'];
  const titles = ['The opening', 'One big adventure', 'The celebration', 'The place', 'With love, you’re invited', 'A little playtime'];
  const nextLabels = ['Open invitation', 'The celebration', 'Find the party', 'You’re invited', 'A little playtime', 'Read again'];
  const previous = document.querySelector('#page-back');
  const next = document.querySelector('#page-next');
  const welcome = pages[0];
  const tip = welcome.querySelector('.writing-tip');
  const strokes = [...welcome.querySelectorAll('.name-stroke')];
  let current = -1;
  let writingFrame = 0;

  function finishWriting() {
    cancelAnimationFrame(writingFrame);
    welcome.classList.remove('is-writing');
    tip.classList.remove('is-visible');
  }
  function playWriting() {
    finishWriting();
    if (document.body.classList.contains('motion-paused') || current !== 0) return;
    // Restart both the ink and the light at the same moment, including on replay.
    void welcome.offsetWidth;
    welcome.classList.add('is-writing');
    const started = performance.now();
    const timing = strokes.map(path => {
      const css = getComputedStyle(path);
      return { path, delay: parseFloat(css.animationDelay) * 1000, duration: parseFloat(css.animationDuration) * 1000, length: path.getTotalLength() };
    });
    function draw(now) {
      const elapsed = now - started;
      const stroke = timing.find(stroke => elapsed >= stroke.delay && elapsed < stroke.delay + stroke.duration);
      tip.classList.toggle('is-visible', !!stroke);
      if (stroke) {
        const point = stroke.path.getPointAtLength(stroke.length * (elapsed - stroke.delay) / stroke.duration);
        tip.setAttribute('cx', point.x);
        tip.setAttribute('cy', point.y);
      }
      if (elapsed < 5400 && current === 0) writingFrame = requestAnimationFrame(draw);
      else tip.classList.remove('is-visible');
    }
    writingFrame = requestAnimationFrame(draw);
  }
  function showPage(index, { focus = true } = {}) {
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      dialog.dataset.navigationClose = 'true';
      dialog.close();
    });
    if (index === current) {
      if (focus) pages[index].focus({ preventScroll: true });
      return;
    }
    const direction = index < current ? 'backward' : 'forward';
    finishWriting();
    current = index;
    pages.forEach((page, i) => {
      page.hidden = i !== index;
      page.inert = i !== index;
      if (i === index) page.scrollTop = 0;
    });
    document.body.dataset.page = pages[index].dataset.page;
    document.body.dataset.pageDirection = direction;
    document.querySelectorAll('[data-section-link]').forEach(link => {
      if (link.hash === hashes[index]) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.querySelector('span').textContent = nextLabels[index];
    document.querySelector('#page-counter').textContent = `${String(index + 1).padStart(2, '0')} / 06`;
    document.querySelector('#page-progress-fill').style.width = `${(index + 1) / pages.length * 100}%`;
    document.querySelector('#page-status').textContent = titles[index];
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) pages[index].focus({ preventScroll: true });
    if (index === 0) playWriting();
  }
  function go(index) {
    if (index < 0 || index >= pages.length) return;
    if (location.hash !== hashes[index]) history.pushState(null, '', hashes[index]);
    showPage(index);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    const index = hashes.indexOf(url.hash);
    if (index === -1) return;
    event.preventDefault();
    go(index);
  });
  const followHistory = () => showPage(Math.max(0, hashes.indexOf(location.hash || '#main')));
  window.addEventListener('popstate', followHistory);
  window.addEventListener('hashchange', followHistory);
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go((current + 1) % pages.length));
  document.querySelector('#replay-writing').addEventListener('click', playWriting);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    let index;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') index = current + 1;
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') index = current - 1;
    if (event.key === 'Home') index = 0;
    if (event.key === 'End') index = pages.length - 1;
    if (index !== undefined) { event.preventDefault(); go(index); }
  });
  let touch;
  const main = document.querySelector('#main');
  main.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 && !event.target.closest('a, button, input, select, textarea')
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  main.addEventListener('touchend', event => {
    if (!touch || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touch.x;
    const dy = event.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
    touch = null;
  }, { passive: true });
  main.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  function syncWritingMotion() {
    const paused = document.body.classList.contains('motion-paused');
    document.querySelector('#replay-writing').disabled = paused;
    if (paused) finishWriting();
  }
  new MutationObserver(syncWritingMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncWritingMotion();
  document.body.classList.add('invitation-ready');
  document.querySelector('#invitation-controls').hidden = false;
  showPage(Math.max(0, hashes.indexOf(location.hash || '#main')), { focus: false });
}
