const cast = [
  { kind: 'lion', name: 'Lion cub', icon: '🦁', section: '.hero' },
  { kind: 'elephant', name: 'Baby elephant', icon: '🐘', section: '#celebration' },
  { kind: 'giraffe', name: 'Little giraffe', icon: '🦒', section: '#venue' },
  { kind: 'monkey', name: 'Little monkey', icon: '🐒', section: '#games' },
  { kind: 'tiger', name: 'Tiger cub', icon: '🐯', section: '#rsvp' },
];
const routine = [
  { state: 'walk', duration: 10000, label: 'Exploring' },
  { state: 'eat', duration: 6000, label: 'Snack time' },
  { state: 'sleep', duration: 8500, label: 'Napping' },
  { state: 'play', duration: 6500, label: 'Playing' },
];
const cycle = routine.reduce((total, step) => total + step.duration, 0);

export function setupSafariFriends() {
  const main = document.querySelector('#main');
  if (!main || main.querySelector('.safari-friends')) return;
  // One illustrated companion belongs to each section and scrolls with that section.
  const stops = cast.map(animal => {
    const section = main.querySelector(animal.section);
    section.classList.add('safari-section');
    const stage = document.createElement('div');
    stage.className = 'safari-friends safari-stop';
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', `${animal.name}: tap for a surprise`);
    section.prepend(stage);
    return stage;
  });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduced.matches || document.body.classList.contains('motion-paused');
  let frame = 0, last = null, sprites;
  const friends = cast.map((animal, i) => {
    const home = document.createElement('div');
    home.className = `safari-home safari-home-${i % 2 ? 'right' : 'left'}`;
    home.dataset.animal = animal.kind;
    home.dataset.state = routine[i % 4].state;
    home.style.setProperty('--safari-top', '8px');
    home.style.setProperty('--safari-inset', '0px');
    home.innerHTML = `<button type="button" class="safari-friend" aria-label="${animal.name}: tap for a playful jumpscare" title="Tap ${animal.name} for a surprise!"><canvas class="safari-canvas" aria-hidden="true"></canvas><span class="safari-fallback" aria-hidden="true">${animal.icon}</span><span class="safari-boo" aria-hidden="true">BOO!</span><span class="safari-zzz" aria-hidden="true">z Z z</span></button><span class="safari-caption" aria-hidden="true"><strong>${animal.name}</strong><span>${routine[i % 4].label}</span></span>`;
    stops[i].append(home);
    const button = home.querySelector('button');
    const friend = { home, button, canvas: home.querySelector('canvas'), caption: home.querySelector('.safari-caption > span'), elapsed: routine.slice(0, i % 4).reduce((total, step) => total + step.duration, 0), visible: false, busy: false, reaction: 0, habitat: null, loading: false };
    button.addEventListener('click', () => {
      if (friend.busy) return;
      friend.busy = true;
      friend.reaction = 0;
      button.dataset.gesture = still() ? 'quiet' : 'boo';
      home.dataset.startled = '';
      render(friend);
      sync();
      setTimeout(() => {
        delete button.dataset.gesture;
        delete home.dataset.startled;
        friend.busy = false;
        render(friend);
      }, 1200);
    });
    return friend;
  });
  function activity(friend) {
    let phase = friend.elapsed % cycle;
    const step = routine.find(step => {
      if (phase < step.duration) return true;
      phase -= step.duration;
      return false;
    });
    return { ...step, phase: phase / step.duration };
  }
  function render(friend) {
    const step = activity(friend);
    friend.home.dataset.state = step.state;
    friend.caption.textContent = step.label;
    friend.habitat?.render(step.state, friend.elapsed, step.phase, friend.busy ? (still() ? .4 : Math.min(1, friend.reaction / 1200)) : null);
  }
  async function load(friend) {
    if (friend.loading) return;
    friend.loading = true;
    try {
      sprites ||= import('./safari-sprites.js');
      const { createHabitat } = await sprites;
      friend.habitat = await createHabitat(friend.canvas, friend.home.dataset.animal);
      friend.home.dataset.renderer = friend.habitat ? '2d' : 'fallback';
      render(friend);
    } catch {
      // Keep the button usable if an illustration cannot load.
      friend.home.dataset.renderer = 'fallback';
    }
  }
  function tick(now) {
    const dt = last === null ? 0 : Math.min(80, now - last);
    last = now;
    for (const friend of friends) {
      if (!friend.visible) continue;
      if (friend.busy) friend.reaction += dt;
      else friend.elapsed += dt;
      render(friend);
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = null;
    const paused = still() || document.hidden;
    stops.forEach(stop => { stop.dataset.paused = String(paused); });
    if (still()) friends.forEach(friend => {
      if (friend.busy) { friend.button.dataset.gesture = 'quiet'; render(friend); }
    });
    if (!paused && friends.some(friend => friend.visible)) frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const friend = friends.find(friend => friend.home === entry.target);
      friend.visible = entry.isIntersecting;
      friend.home.dataset.visible = String(entry.isIntersecting);
      if (friend.visible) { load(friend); render(friend); }
    }
    sync();
  });
  friends.forEach(friend => observer.observe(friend.home));
  window.addEventListener('resize', () => friends.filter(friend => friend.visible).forEach(render));
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}
