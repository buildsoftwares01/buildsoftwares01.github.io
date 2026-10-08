import { createHabitat } from './safari-sprites.js';

const names = { lion: 'Lion', elephant: 'Elephant', giraffe: 'Giraffe', monkey: 'Monkey', tiger: 'Tiger' };

export function setupPlayCorner() {
  const playground = document.querySelector('#little-playground');
  if (!playground) return;
  const $ = selector => playground.querySelector(selector);
  const quiet = () => {
    const bounds = playground.getBoundingClientRect();
    return bounds.bottom <= 0 || bounds.top >= innerHeight || document.body.classList.contains('motion-paused') || document.body.classList.contains('motion-dialog') || document.hidden;
  };
  const animations = new Set();
  const canvasRuns = new Set();
  const artwork = new Map();
  const found = new Set();
  let leafPicked = false, feeding = false;
  playground.hidden = false;

  function animate(element, frames, options) {
    if (quiet()) return null;
    const animation = element.animate(frames, { duration: 900, easing: 'ease-out', ...options });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }

  function confetti(card, source, count = 16) {
    if (quiet()) return;
    const burst = document.createElement('span');
    burst.className = 'party-confetti';
    burst.setAttribute('aria-hidden', 'true');
    card.append(burst);
    const bounds = card.getBoundingClientRect();
    const origin = source.getBoundingClientRect();
    const x = origin.left + origin.width / 2 - bounds.left;
    const y = origin.top + origin.height / 3 - bounds.top;
    const particles = [];
    for (let i = 0; i < count; i++) {
      const star = document.createElement('i');
      star.className = `party-star star-colour-${i % 4}`;
      star.style.left = `${x}px`;
      star.style.top = `${y}px`;
      burst.append(star);
      const angle = i / count * Math.PI * 2;
      const distance = 40 + i % 4 * 16;
      const dx = Math.cos(angle) * distance, dy = Math.sin(angle) * distance;
      particles.push(animate(star, [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
        { transform: `translate(${dx}px,${dy - 15}px) rotate(80deg) scale(1)`, opacity: 1, offset: .45 },
        { transform: `translate(${dx * 1.2}px,${dy + 75}px) rotate(160deg) scale(.6)`, opacity: 0 },
      ], { duration: 1000 + i % 4 * 120 }));
    }
    Promise.allSettled(particles.filter(Boolean).map(animation => animation.finished)).then(() => burst.remove());
  }

  function drawActor(canvas, elapsed = 0, progress = .4, still = true) {
    const actor = artwork.get(canvas);
    if (!actor) return;
    actor.pose = [elapsed, progress, still];
    actor.habitat.render('walk', elapsed, 0, progress, still);
  }

  function playActor(canvas) {
    if (!artwork.has(canvas)) return;
    for (const run of canvasRuns) {
      if (run.canvas !== canvas) continue;
      cancelAnimationFrame(run.id);
      canvasRuns.delete(run);
    }
    if (quiet()) { drawActor(canvas); return; }
    const start = performance.now();
    const run = { id: 0, canvas };
    canvasRuns.add(run);
    const tick = now => {
      const elapsed = Math.max(0, now - start);
      const progress = Math.min(1, elapsed / 1200);
      drawActor(canvas, elapsed, progress, false);
      if (progress < 1 && !quiet()) run.id = requestAnimationFrame(tick);
      else { canvasRuns.delete(run); drawActor(canvas); }
    };
    run.id = requestAnimationFrame(tick);
  }

  function stopMotion() {
    if (!quiet()) return;
    for (const animation of animations) animation.cancel();
    for (const run of canvasRuns) {
      cancelAnimationFrame(run.id);
      drawActor(run.canvas);
    }
    canvasRuns.clear();
    playground.querySelectorAll('.party-confetti').forEach(burst => burst.remove());
  }
  new MutationObserver(stopMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', stopMotion);
  new IntersectionObserver(stopMotion).observe(playground);

  const resizeArtwork = new ResizeObserver(entries => entries.forEach(({ target }) => {
    const actor = artwork.get(target);
    if (actor) drawActor(target, ...actor.pose);
  }));
  playground.querySelectorAll('[data-play-animal]').forEach(async canvas => {
    const button = canvas.closest('.seek-bush');
    if (button) button.disabled = true;
    try {
      const habitat = await createHabitat(canvas, canvas.dataset.playAnimal);
      if (!habitat) throw new Error('Canvas unavailable');
      artwork.set(canvas, { habitat, pose: [0, .4, true] });
      drawActor(canvas);
      canvas.dataset.art = 'ready';
      resizeArtwork.observe(canvas);
      if (canvas.closest('.feed-giraffe')) $('#feed-giraffe').disabled = false;
    } catch {
      canvas.hidden = true;
      canvas.dataset.art = 'unavailable';
      if (canvas.closest('.feed-giraffe')) {
        $('#pick-leaf').disabled = true;
        $('#feed-status').textContent = 'Giraffe is resting. Try a balloon or make a birthday wish!';
      }
    } finally {
      if (button) button.disabled = false;
    }
  });

  playground.querySelectorAll('.balloon-button').forEach(button => {
    button.addEventListener('click', () => {
      button.disabled = true;
      button.classList.add('is-popped');
      $('#balloon-status').textContent = 'A little shower of stars! Pick another balloon.';
      confetti(button.closest('.activity-card'), button);
      animate(button.querySelector('.balloon-reply'), [
        { transform: 'scale(.7)', opacity: .5 }, { transform: 'scale(1)', opacity: 1 },
      ], { duration: 300 });
      setTimeout(() => {
        button.classList.remove('is-popped');
        button.disabled = false;
        animate(button.querySelector('.balloon-shape'), [
          { transform: 'translateY(12px) scale(.7)', opacity: 0 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ], { duration: 350 });
      }, 850);
    });
  });

  const cake = $('.cake-card');
  $('#birthday-candle').addEventListener('click', () => {
    cake.classList.add('wish-made');
    $('#birthday-candle').disabled = true;
    $('#wish-status').textContent = 'Happy birthday, Vihaan! Your wish is on its way. ♡';
    $('#relight-candle').hidden = false;
    confetti(cake, $('#birthday-candle'), 20);
    cake.querySelectorAll('canvas').forEach(playActor);
    animate($('.candle-smoke'), [
      { transform: 'translateY(0)', opacity: .6 },
      { transform: 'translateY(-12px)', opacity: 0 },
    ], { duration: 900 });
  });
  $('#relight-candle').addEventListener('click', () => {
    cake.classList.remove('wish-made');
    $('#birthday-candle').disabled = false;
    $('#relight-candle').hidden = true;
    $('#wish-status').textContent = 'One little candle. Ready for another lovely wish.';
    $('#birthday-candle').focus({ preventScroll: true });
  });

  $('#pick-leaf').addEventListener('click', () => {
    leafPicked = !leafPicked;
    $('#pick-leaf').setAttribute('aria-pressed', String(leafPicked));
    $('.feed-card').classList.toggle('leaf-picked', leafPicked);
    $('#feed-status').textContent = leafPicked ? 'Leaf ready! Now tap the giraffe.' : 'Pick a leaf, then tap the giraffe.';
  });
  $('#feed-giraffe').addEventListener('click', () => {
    if (feeding) return;
    if (!leafPicked) { $('#feed-status').textContent = 'First pick a leaf, then tap the giraffe.'; return; }
    feeding = true;
    leafPicked = false;
    const card = $('.feed-card');
    const target = $('#feed-giraffe');
    card.classList.remove('leaf-picked');
    card.classList.add('is-feeding');
    $('#pick-leaf').setAttribute('aria-pressed', 'false');
    $('#pick-leaf').disabled = true;
    target.disabled = true;
    $('#feed-status').textContent = 'Yum! Giraffe loves your leafy snack.';
    playActor(target.querySelector('canvas'));
    if (!quiet()) {
      const leaf = $('#pick-leaf svg').cloneNode(true);
      leaf.classList.add('leaf-flight');
      const bounds = card.getBoundingClientRect();
      const from = $('#pick-leaf svg').getBoundingClientRect();
      const to = target.getBoundingClientRect();
      leaf.style.left = `${from.left - bounds.left}px`;
      leaf.style.top = `${from.top - bounds.top}px`;
      card.append(leaf);
      const flight = animate(leaf, [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${to.left - from.left + to.width * .55}px,${to.top - from.top + 30}px) rotate(30deg) scale(.35)`, opacity: 0 },
      ], { duration: 750 });
      flight?.finished.catch(() => {}).finally(() => leaf.remove());
    }
    setTimeout(() => {
      feeding = false;
      card.classList.remove('is-feeding');
      $('#pick-leaf').disabled = false;
      target.disabled = false;
      $('#feed-status').textContent = 'That was delicious! Pick another leaf to feed giraffe again.';
    }, 1200);
  });

  playground.querySelectorAll('.seek-bush').forEach(button => {
    button.addEventListener('click', () => {
      const kind = button.dataset.seek;
      if (found.has(kind)) return;
      found.add(kind);
      button.classList.add('is-found');
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', `${names[kind]} found`);
      button.querySelector('.seek-name').textContent = names[kind];
      const sticker = $(`[data-sticker="${kind}"]`);
      sticker.classList.add('is-collected');
      sticker.setAttribute('aria-label', `${names[kind]}: found`);
      const source = button.querySelector('canvas');
      if (artwork.has(source)) {
        const portrait = document.createElement('canvas');
        portrait.width = source.width; portrait.height = source.height;
        portrait.setAttribute('aria-hidden', 'true');
        portrait.getContext('2d').drawImage(source, 0, 0);
        sticker.replaceChildren(portrait);
      } else sticker.textContent = names[kind];
      playActor(source);
      $('#seek-status').textContent = `Found ${found.size} of 5 safari friends. Hello, ${names[kind]}!`;
      if (found.size === 5) {
        $('#seek-status').textContent = 'You found all five friends! Happy safari adventures!';
        $('#replay-seek').hidden = false;
        confetti($('.seek-card'), button, 20);
      }
    });
  });
  $('#replay-seek').addEventListener('click', () => {
    found.clear();
    playground.querySelectorAll('.seek-bush').forEach((button, index) => {
      button.classList.remove('is-found');
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `Look behind bush ${index + 1}`);
      button.querySelector('.seek-name').textContent = 'Tap a leaf';
    });
    playground.querySelectorAll('[data-sticker]').forEach(sticker => {
      sticker.classList.remove('is-collected');
      sticker.setAttribute('aria-label', `${names[sticker.dataset.sticker]}: not found`);
      sticker.textContent = '✦';
    });
    $('#replay-seek').hidden = true;
    $('#seek-status').textContent = 'Found 0 of 5 safari friends. Let’s find them again!';
    $('.seek-bush').focus({ preventScroll: true });
  });
}
