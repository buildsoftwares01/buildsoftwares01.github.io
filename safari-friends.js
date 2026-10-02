// Local SVG companions: every home belongs to the document, never the viewport.
const face = `<g class="safari-eyes" fill="#382f26" stroke="none"><circle cx="27" cy="25" r="1.8"/><circle cx="37" cy="25" r="1.8"/><circle cx="27.5" cy="24.5" r=".5" fill="#fff"/><circle cx="37.5" cy="24.5" r=".5" fill="#fff"/></g><path class="safari-sleep-eyes" d="M24 25q3 3 6 0m4 0q3 3 6 0"/><path class="safari-smile" d="M29 33q3 3 6 0"/><g class="safari-surprise"><ellipse cx="27" cy="25" rx="3" ry="4" fill="#fff9e9"/><ellipse cx="37" cy="25" rx="3" ry="4" fill="#fff9e9"/><circle cx="27" cy="26" r="1.5" fill="#382f26"/><circle cx="37" cy="26" r="1.5" fill="#382f26"/><ellipse cx="32" cy="34" rx="3" ry="4" fill="#60402e"/></g>`;
const paws = color => `<g stroke="${color}" stroke-width="7"><path class="safari-leg safari-leg-back" d="M22 45v10"/><path class="safari-leg safari-leg-front" d="M42 45v10"/></g><path d="M19 56h6m14 0h6" stroke="#604a37"/>`;
const animals = [
  { name: 'Lion', food: '🍖', art: `<path class="safari-tail" d="M43 45q18 1 11-12" stroke="#af713e" stroke-width="3"/><circle cx="54" cy="33" r="3" fill="#b57746"/><ellipse cx="32" cy="43" rx="15" ry="12" fill="#e8b661"/>${paws('#e8b661')}<g class="safari-head"><path d="m32 7 7 4 8 1 2 8 4 7-5 7-2 8-9 1-7 3-7-5-8-2-1-9-3-7 6-6 3-7Z" fill="#b57746"/><circle cx="32" cy="25" r="14" fill="#edc477"/><ellipse cx="32" cy="31" rx="8" ry="6" fill="#fae4b4"/><path d="m29 28 3 3 3-3" fill="#60402e"/>${face}</g>` },
  { name: 'Giraffe', food: '🌿', art: `<path class="safari-tail" d="M44 44q11-2 10 6" stroke="#bd884c" stroke-width="2"/>${paws('#dab36b')}<ellipse cx="34" cy="42" rx="14" ry="8" fill="#e6c078"/><path d="m24 41 2-23h11l1 26" fill="#e6c078"/><g fill="#aa7746"><circle cx="28" cy="36" r="3"/><circle cx="36" cy="43" r="3"/><circle cx="43" cy="40" r="2"/></g><g class="safari-head"><path d="M26 12 24 5m13 7 3-7" stroke="#98704a" stroke-width="3"/><path d="M25 15Q10 5 17 20m21-5Q52 5 47 21" fill="#e6c078"/><rect x="21" y="11" width="23" height="22" rx="10" fill="#e6c078"/><ellipse cx="32" cy="29" rx="12" ry="6" fill="#f1d6a0"/>${face}</g>` },
  { name: 'Tiger', food: '🍖', art: `<path class="safari-tail" d="M44 44q17 4 10-10" stroke="#ca8951" stroke-width="4"/><ellipse cx="32" cy="43" rx="15" ry="11" fill="#dda064"/>${paws('#dda064')}<path d="m19 42 6 3m20-3-6 3" stroke="#654535" stroke-width="3"/><g class="safari-head"><circle cx="20" cy="14" r="6" fill="#bc7b48"/><circle cx="44" cy="14" r="6" fill="#bc7b48"/><rect x="16" y="12" width="32" height="28" rx="13" fill="#e4a564"/><path d="m27 13 3 7m7-7-3 7m-17 3 7 3m-7 5 7-1m23-7-7 3m7 5-7-1" stroke="#654535" stroke-width="3"/><ellipse cx="32" cy="32" rx="9" ry="6" fill="#fae8c4"/><path d="m29 28 3 3 3-3" fill="#654535"/>${face}</g>` },
  { name: 'Elephant', food: '🍌', art: `<path class="safari-tail" d="M45 42q12 0 9 8" stroke="#879e97" stroke-width="3"/><ellipse cx="32" cy="43" rx="17" ry="11" fill="#9bb0a6"/>${paws('#9bb0a6')}<g class="safari-head"><ellipse cx="17" cy="25" rx="11" ry="14" fill="#8fa69e"/><ellipse cx="47" cy="25" rx="11" ry="14" fill="#8fa69e"/><ellipse cx="17" cy="25" rx="6" ry="9" fill="#c0c6b5"/><ellipse cx="47" cy="25" rx="6" ry="9" fill="#c0c6b5"/><circle cx="32" cy="24" r="15" fill="#a9bcb0"/>${face}<path class="safari-trunk" d="M32 29v13q0 10 8 3" stroke="#a9bcb0" stroke-width="7"/></g>` },
];
const routine = [
  { state: 'walk', duration: 10000, label: 'Walking' },
  { state: 'eat', duration: 6000, label: 'Snack time' },
  { state: 'sleep', duration: 8500, label: 'Napping' },
  { state: 'play', duration: 6500, label: 'Playing' },
];
const cycle = routine.reduce((total, step) => total + step.duration, 0);

export function setupSafariFriends() {
  const main = document.querySelector('#main');
  if (!main || main.querySelector('.safari-friends')) return;
  main.classList.add('safari-inhabited');
  const layer = document.createElement('div');
  layer.className = 'safari-friends';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'Safari animals: tap for a playful surprise');
  main.append(layer);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 760px)');
  const still = () => reduced.matches || document.body.classList.contains('motion-paused');
  let frame = 0, last = null;
  const friends = animals.map((animal, i) => {
    const home = document.createElement('div');
    home.className = `safari-home safari-home-${i}`;
    home.dataset.state = routine[i].state;
    home.innerHTML = `<span class="safari-trail" aria-hidden="true"></span><span class="safari-food" aria-hidden="true">${animal.food}</span><span class="safari-ball" aria-hidden="true"></span><button type="button" class="safari-friend" aria-label="${animal.name}: tap for a playful jumpscare" title="Tap ${animal.name} for a surprise!"><span class="safari-friend-art"><svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#604a37" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${animal.art}</svg></span><span class="safari-boo" aria-hidden="true">BOO!</span><span class="safari-zzz" aria-hidden="true">z Z</span></button><span class="safari-caption" aria-hidden="true">${routine[i].label}</span>`;
    layer.append(home);
    const button = home.querySelector('button');
    const friend = { home, button, caption: home.querySelector('.safari-caption'), elapsed: routine.slice(0, i).reduce((total, step) => total + step.duration, 0), visible: false, busy: false, timer: null };
    button.addEventListener('click', () => {
      if (friend.busy) return;
      friend.busy = true;
      button.dataset.gesture = still() ? 'quiet' : 'boo';
      home.dataset.startled = '';
      friend.timer = setTimeout(() => {
        delete button.dataset.gesture;
        delete home.dataset.startled;
        friend.busy = false;
      }, 1200);
    });
    return friend;
  });

  function render(friend) {
    let phase = friend.elapsed % cycle;
    const step = routine.find(step => {
      if (phase < step.duration) return true;
      phase -= step.duration;
      return false;
    });
    if (friend.home.dataset.state !== step.state) {
      friend.home.dataset.state = step.state;
      friend.caption.textContent = step.label;
    }
    // An ellipse gives the circle depth. Turn the face in the walking direction.
    const angle = phase / step.duration * Math.PI * 4;
    const x = step.state === 'walk' ? Math.sin(angle) * (compact.matches ? 10 : 20) : 0;
    const y = step.state === 'walk' ? (1 - Math.cos(angle)) * (compact.matches ? 3 : 5) : 0;
    friend.button.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    friend.button.style.setProperty('--safari-facing', step.state === 'walk' && Math.cos(angle) < 0 ? '-1' : '1');
  }
  function tick(now) {
    const dt = last === null ? 0 : Math.min(80, now - last);
    last = now;
    for (const friend of friends) {
      // Pause offscreen routines, and hold under a pointer or keyboard focus.
      if (!friend.visible || friend.busy || friend.button.matches(':hover, :focus-visible')) continue;
      friend.elapsed += dt;
      render(friend);
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = null;
    const paused = still();
    layer.dataset.paused = String(paused || document.hidden);
    if (paused) friends.forEach(({ button }) => {
      if (button.dataset.gesture) button.dataset.gesture = 'quiet';
    });
    if (!paused && !document.hidden && friends.some(friend => friend.visible)) frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const friend = friends.find(friend => friend.home === entry.target);
      friend.visible = entry.isIntersecting;
      friend.home.dataset.visible = String(entry.isIntersecting);
    }
    sync();
  });
  friends.forEach(friend => { render(friend); observer.observe(friend.home); });
  compact.addEventListener('change', () => friends.forEach(render));
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}
