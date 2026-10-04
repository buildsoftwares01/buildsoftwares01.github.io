import { createHabitat } from './safari-sprites.js';

const cast = [
  { kind: 'lion', name: 'Lion cub', state: 'walk', duration: 10000 },
  { kind: 'elephant', name: 'Baby elephant', state: 'sleep', duration: 4800 },
  { kind: 'giraffe', name: 'Little giraffe', state: 'eat', duration: 4800 },
  { kind: 'monkey', name: 'Little monkey', state: 'play', duration: 5200 },
  { kind: 'tiger', name: 'Tiger cub', state: 'roll', duration: 6200 },
];
export function setupSafariFriends() {
  const main = document.querySelector('#main');
  if (!main || main.querySelector('.safari-friends')) return;
  // Companions sit beside their heading phrases and scroll with the document.
  const stops = cast.map(animal => {
    const anchor = main.querySelector(`[data-safari-anchor="${animal.kind}"]`);
    const stage = document.createElement('span');
    stage.className = 'safari-friends safari-stop';
    stage.setAttribute('role', 'group');
    stage.setAttribute('aria-label', `${animal.name}: tap for a surprise`);
    anchor.append(stage);
    return stage;
  });
  const still = () => document.body.classList.contains('motion-dialog') || document.body.classList.contains('motion-paused');
  let frame = 0, last = null;
  const friends = cast.map((animal, i) => {
    const home = document.createElement('span');
    home.className = 'safari-home';
    home.dataset.animal = animal.kind;
    home.dataset.state = animal.state;
    home.innerHTML = `<button disabled type="button" class="safari-friend" aria-label="${animal.name}: tap for a playful jumpscare" title="Tap ${animal.name} for a surprise!"><canvas class="safari-canvas" aria-hidden="true"></canvas><span class="safari-boo" aria-hidden="true">BOO!</span><span class="safari-zzz" aria-hidden="true">z Z z</span></button>`;
    stops[i].append(home);
    const button = home.querySelector('button');
    const friend = { home, button, canvas: home.querySelector('canvas'), activity: animal.state, duration: animal.duration, elapsed: 0, visible: false, busy: false, reaction: 0, habitat: null, loading: false };
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
  function render(friend) {
    const phase = friend.elapsed % friend.duration / friend.duration;
    friend.habitat?.render(friend.activity, friend.elapsed, phase, friend.busy ? (still() ? .4 : Math.min(1, friend.reaction / 1200)) : null);
  }
  async function load(friend) {
    if (friend.loading) return;
    friend.loading = true;
    try {
      friend.habitat = await createHabitat(friend.canvas, friend.home.dataset.animal);
      if (!friend.habitat) throw new Error('Canvas unavailable');
      render(friend);
      friend.home.dataset.renderer = '2d';
      friend.button.disabled = false;
    } catch {
      // Keep the reserved heading space, without flashing a substitute face.
      friend.home.dataset.renderer = 'unavailable';
      friend.home.setAttribute('aria-hidden', 'true');
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
    friends.forEach(friend => {
      if (friend.busy) friend.button.dataset.gesture = still() ? 'quiet' : 'boo';
      if (friend.visible) render(friend);
    });
    if (!paused && friends.some(friend => friend.visible)) frame = requestAnimationFrame(tick);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const friend = friends.find(friend => friend.home === entry.target);
      friend.visible = entry.isIntersecting;
      friend.home.dataset.visible = String(entry.isIntersecting);
      if (friend.visible) render(friend);
    }
    sync();
  });
  // Decode and paint every animal now, even if its heading is below the fold.
  void Promise.all(friends.map(load));
  friends.forEach(friend => observer.observe(friend.home));
  window.addEventListener('resize', () => friends.filter(friend => friend.visible).forEach(render));
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
}
