// Small vector companions stay crisp at finger size and need no image downloads.
const eyes = '<g fill="#382f26"><circle cx="27" cy="25" r="1.6"/><circle cx="37" cy="25" r="1.6"/></g><path d="M29 32q3 3 6 0" fill="none"/>';
const animals = [
  { name: 'Lion', gesture: 'cartwheel', art: '<path d="M43 45q18 1 11-12" fill="none" stroke="#af713e" stroke-width="3"/><ellipse cx="32" cy="43" rx="15" ry="12" fill="#e8b661"/><path d="M22 46v9m20-9v9" stroke="#e8b661" stroke-width="7"/><path d="m32 7 7 4 8 1 2 8 4 7-5 7-2 8-9 1-7 3-7-5-8-2-1-9-3-7 6-6 3-7Z" fill="#b57746"/><circle cx="32" cy="25" r="14" fill="#edc477"/><ellipse cx="32" cy="31" rx="8" ry="6" fill="#fae4b4"/><path d="m29 28 3 3 3-3" fill="#60402e"/>' + eyes },
  { name: 'Giraffe', gesture: 'wiggle', art: '<path d="M44 44q11-2 10 6" fill="none" stroke="#bd884c" stroke-width="2"/><path d="M24 43v13m18-13v13" stroke="#dab36b" stroke-width="5"/><ellipse cx="34" cy="42" rx="14" ry="8" fill="#e6c078"/><path d="m24 41 2-23h11l1 26" fill="#e6c078"/><path d="M26 12 24 5m13 7 3-7" stroke="#98704a" stroke-width="3"/><path d="M25 15Q10 5 17 20m21-5Q52 5 47 21" fill="#e6c078"/><rect x="21" y="11" width="23" height="22" rx="10" fill="#e6c078"/><ellipse cx="32" cy="29" rx="12" ry="6" fill="#f1d6a0"/><g fill="#aa7746"><circle cx="28" cy="36" r="3"/><circle cx="36" cy="43" r="3"/><circle cx="43" cy="40" r="2"/></g>' + eyes },
  { name: 'Tiger', gesture: 'pounce', art: '<path d="M44 44q17 4 10-10" fill="none" stroke="#ca8951" stroke-width="4"/><ellipse cx="32" cy="43" rx="15" ry="11" fill="#dda064"/><path d="M23 46v9m18-9v9" stroke="#dda064" stroke-width="7"/><circle cx="20" cy="14" r="6" fill="#bc7b48"/><circle cx="44" cy="14" r="6" fill="#bc7b48"/><rect x="16" y="12" width="32" height="28" rx="13" fill="#e4a564"/><path d="m27 13 3 7m7-7-3 7m-17 3 7 3m-7 5 7-1m23-7-7 3m7 5-7-1m-18 12 5 3m15-3-5 3" fill="none" stroke="#654535" stroke-width="3"/><ellipse cx="32" cy="32" rx="9" ry="6" fill="#fae8c4"/><path d="m29 28 3 3 3-3" fill="#654535"/>' + eyes },
  { name: 'Elephant', gesture: 'spin', art: '<path d="M45 42q12 0 9 8" fill="none" stroke="#879e97" stroke-width="3"/><ellipse cx="32" cy="43" rx="17" ry="11" fill="#9bb0a6"/><path d="M22 45v10m20-10v10" stroke="#9bb0a6" stroke-width="8"/><ellipse cx="17" cy="25" rx="11" ry="14" fill="#8fa69e"/><ellipse cx="47" cy="25" rx="11" ry="14" fill="#8fa69e"/><ellipse cx="17" cy="25" rx="6" ry="9" fill="#c0c6b5"/><ellipse cx="47" cy="25" rx="6" ry="9" fill="#c0c6b5"/><circle cx="32" cy="24" r="15" fill="#a9bcb0"/><path d="M32 29v13q0 10 8 3" fill="none" stroke="#a9bcb0" stroke-width="8"/><g fill="#382f26"><circle cx="26" cy="25" r="1.6"/><circle cx="38" cy="25" r="1.6"/></g>' },
];

export function setupSafariFriends() {
  const layer = document.createElement('div');
  layer.className = 'safari-friends';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'Playful safari friends');
  document.body.append(layer);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = innerWidth, height = innerHeight, scroll = scrollY, drift = 0, time = 0, last = 0, frame;
  const still = () => reduced.matches || document.body.classList.contains('motion-paused');
  const friends = animals.map((animal, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'safari-friend';
    button.setAttribute('aria-label', `${animal.name}: tap for a ${animal.gesture}`);
    button.title = `Tap for a ${animal.gesture}!`;
    button.innerHTML = `<span class="safari-friend-art"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#604a37" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${animal.art}</svg></span><span class="safari-friend-joy" aria-hidden="true">✦</span>`;
    layer.append(button);
    const friend = { button, i, y: height * (.24 + i * .17), busy: false, timer: null };
    button.addEventListener('click', () => {
      if (friend.busy) return;
      friend.busy = true;
      button.dataset.gesture = still() ? 'quiet' : animal.gesture;
      friend.timer = setTimeout(() => {
        delete button.dataset.gesture;
        friend.busy = false;
      }, 1100);
    });
    return friend;
  });
  function position(dt = 0) {
    for (const friend of friends) {
      const { button, i } = friend;
      const wave = Math.sin(time / 2600 + i * 1.8);
      const inset = width > 760 ? 12 + (wave + 1) * 14 : 3 + (wave + 1) * 3;
      const x = i % 2 ? width - 48 - inset : inset;
      const target = Math.max(76, Math.min(height - 70, height * (.24 + i * .17) + wave * 24 + drift));
      // Hold still under a finger or keyboard focus so a friend is easy to catch.
      if (!friend.busy && !button.matches(':hover, :focus-visible')) {
        friend.y += (target - friend.y) * (dt ? 1 - Math.exp(-dt / 220) : 1);
        button.style.transform = `translate3d(${Math.max(0, x)}px,${Math.max(0, Math.min(height - 48, friend.y))}px,0)`;
      }
    }
  }
  function tick(now) {
    const dt = Math.min(40, now - (last || now));
    last = now;
    time += dt;
    drift *= Math.exp(-dt / 650);
    position(dt);
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    if (still()) {
      friends.forEach(({ button }) => { if (button.dataset.gesture) button.dataset.gesture = 'quiet'; });
    }
    if (!still() && !document.hidden) frame = requestAnimationFrame(tick);
  }
  window.addEventListener('scroll', () => {
    const delta = scrollY - scroll;
    scroll = scrollY;
    if (!still()) drift = Math.max(-65, Math.min(65, drift + delta * .22));
  }, { passive: true });
  window.addEventListener('resize', () => {
    width = innerWidth;
    height = innerHeight;
    position();
  });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  position();
  sync();
}
