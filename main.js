import { setupLeaderboards } from './leaderboard.js';
import { event } from './event-config.js';
import { getEventDate } from './event-details.js';
import { setupSafariFriends } from './safari-friends.js';
setupSafariFriends();
const $ = (s) => document.querySelector(s);
const paths = { calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', message: '<path d="m4 17-1 5 5-2a9 9 0 1 0-4-3Z"/><path d="M8 8c0 4 4 7 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>' };
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[el.dataset.icon]}</svg>`; });
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  document.body.classList.add('motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
// One control pauses the decorative movement and the scrolling message strap.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = $('#motion-toggle');
function syncMotionControl() { motionToggle.hidden = motionPreference.matches; }
syncMotionControl();
motionPreference.addEventListener('change', syncMotionControl);
motionToggle.addEventListener('click', () => {
  const paused = document.body.classList.toggle('motion-paused');
  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.setAttribute('aria-label', paused ? 'Resume animations' : 'Pause animations');
  motionToggle.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
  motionToggle.querySelector('.motion-label').textContent = paused ? 'Play' : 'Pause';
});
// Keep each accent's space in the layout while it pops away for one second.
const poppingAccents = new WeakSet();
function sparkleAccent(accent) {
  const rect = accent.getBoundingClientRect();
  const burst = document.createElement('span');
  burst.className = 'accent-magic-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  // Stay above the backdrop when an accent belongs to an open dialog.
  (accent.closest('dialog') || document.body).append(burst);
  const radius = Math.min(90, Math.max(35, rect.width * .4));
  const animations = Array.from({ length: 10 }, (_, i) => {
    const spark = document.createElement('span');
    spark.textContent = ['✦', '✧', '·'][i % 3];
    burst.append(spark);
    const angle = i * Math.PI * 2 / 10;
    const distance = radius * (i % 2 ? 1 : .7);
    return spark.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { opacity: 1, offset: .18 },
      { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) rotate(${i % 2 ? 100 : -100}deg) scale(.3)`, opacity: 0 },
    ], { duration: 650, easing: 'ease-out' }).finished;
  });
  Promise.allSettled(animations).then(() => burst.remove());
}
document.querySelectorAll('h1 em, h2 em, .word-accent, .brand-icon span, .footer-brand span, .heart-mark, .signature > span, .floating-heart, .rsvp-heart, .art-spark, .title-star, .one > span:last-child, .preview-doodle, .hex-inner, #score-error').forEach(accent => {
  accent.classList.add('pop-accent');
  if (getComputedStyle(accent).display === 'inline') accent.classList.add('pop-accent-inline');
  const hasControl = accent.closest('a, button');
  if (!hasControl && !accent.closest('[aria-hidden="true"]') && !accent.matches('[role="status"]')) {
    accent.tabIndex = 0;
    accent.setAttribute('role', 'button');
  }
  const pop = () => {
    if (poppingAccents.has(accent)) return;
    poppingAccents.add(accent);
    const still = motionPreference.matches || document.body.classList.contains('motion-paused');
    if (!still) sparkleAccent(accent);
    const frames = still
      ? [{ opacity: 0 }, { opacity: 0, offset: .85 }, { opacity: 1 }]
      : [
          { scale: '1', opacity: 1, filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
          { scale: '1.25', opacity: 1, filter: 'brightness(1.5) drop-shadow(0 0 8px #e5b65c)', offset: .12 },
          { scale: '.65', opacity: 0, filter: 'brightness(1.5) drop-shadow(0 0 8px #e5b65c)', offset: .25 },
          { scale: '.65', opacity: 0, filter: 'brightness(1.5) drop-shadow(0 0 8px #e5b65c)', offset: .8 },
          { scale: '1', opacity: 1, filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
        ];
    // Separate scale from the existing decorative transforms; no layout shift.
    const animation = accent.animate(frames, { duration: 1000, easing: 'ease-out' });
    const finish = () => poppingAccents.delete(accent);
    animation.onfinish = finish;
    animation.oncancel = finish;
  };
  // A mouse touching the word should feel as playful as a finger touching it.
  // Touch pointers enter before scrolling too, so only hover with a mouse.
  accent.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') pop(); });
  accent.addEventListener('pointerdown', e => { if (e.isPrimary && e.button === 0) pop(); });
  accent.addEventListener('click', pop);
  if (accent.getAttribute('role') === 'button' && !hasControl) {
    accent.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) pop(); }
    });
  }
});
const games = {
  taptaptap: { name: 'Tap Tap Tap', help: 'Tap the blue circles before time runs out. Avoid red circles. Start with New Game.' },
  flappy: { name: 'Safari Flyer', help: 'Tap to flap through the green branches. On a computer, click or press Space.' },
  hextris: { name: 'Hextris', help: 'Tap the left or right side to rotate. Match three colours. Keyboard: ← →.' },
  ohhi: { name: '0h h1', help: 'Tap tiles to change colour. Start with “How to play” for a friendly tutorial.' },
};
const gameDialog = $('#game-dialog');
let activeGame, gameTrigger, loadingTimer;
const gameContainer = $('#game-frame-container');
function clearGameLoading() {
  clearTimeout(loadingTimer);
  gameContainer.removeAttribute('aria-busy');
}
window.addEventListener('message', event => {
  const frame = gameContainer.querySelector('iframe');
  if (!frame || event.source !== frame.contentWindow || event.data?.type !== 'invitation:game-ready') return;
  clearGameLoading();
  gameContainer.querySelector('.game-loading')?.remove();
  frame.removeAttribute('inert');
  frame.removeAttribute('aria-hidden');
  frame.classList.remove('is-loading');
});
const leaderboards = setupLeaderboards({ gameDialog, getGame: () => activeGame, getFrame: () => $('#game-frame-container iframe') });
function loadGame() {
  leaderboards.reset();
  clearGameLoading();
  gameContainer.setAttribute('aria-busy', 'true');
  const hero = document.createElement('div');
  hero.className = 'game-loading';
  hero.innerHTML = `<img src="./assets/safari.webp" alt="" width="360" height="300"><span class="eyebrow">A LITTLE WILD ADVENTURE</span><h3></h3><p role="status">Getting your adventure ready…</p><span class="game-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
  hero.querySelector('h3').textContent = games[activeGame].name;
  const frame = document.createElement('iframe');
  frame.title = games[activeGame].name + ' browser game';
  // No same-origin, popups, forms, downloads, or top-level navigation privileges.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.className = 'is-loading';
  frame.setAttribute('inert', '');
  frame.setAttribute('aria-hidden', 'true');
  frame.src = `./games/${activeGame}/index.html`;
  gameContainer.replaceChildren(hero, frame);
  loadingTimer = setTimeout(() => {
    hero.querySelector('[role="status"]').textContent = 'Taking a little longer. You can wait or try Restart below.';
  }, 15000);
}
document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => {
  activeGame = button.dataset.game;
  gameTrigger = button;
  $('#game-title').textContent = games[activeGame].name;
  $('#game-help').textContent = games[activeGame].help;
  gameDialog.showModal();
  loadGame();
}));
$('#close-game').addEventListener('click', () => gameDialog.close());
$('#restart-game').addEventListener('click', loadGame);
gameDialog.addEventListener('close', () => { clearGameLoading(); leaderboards.reset(); $('#game-frame-container').replaceChildren(); gameTrigger?.focus(); });
const rsvpDialog = $('#rsvp-dialog');
const rsvpReady = /^[1-9]\d{7,14}$/.test(event.whatsappNumber);
$('#rsvp-button').addEventListener('click', () => {
  $('#rsvp-form').hidden = !rsvpReady;
  $('#rsvp-unavailable').hidden = rsvpReady;
  rsvpDialog.showModal();
});
if (!rsvpReady) $('#rsvp-note').textContent = 'WhatsApp RSVP details coming soon';
$('#close-rsvp').addEventListener('click', () => rsvpDialog.close());
$('#rsvp-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!rsvpReady) return;
  const name = $('#guest-name').value.trim();
  if (!name) { $('#guest-name').setCustomValidity('Please enter your name.'); $('#guest-name').reportValidity(); return; }
  const count = $('#guest-count').value;
  const message = `Hi Madhav & Urvashee! It's ${name}. We'd love to celebrate Vihaan's first birthday at Paps Restaurant. RSVP: ${count} ${count === '1' ? 'guest' : 'guests'}. Can’t wait for cake and birthday adventures!`;
  window.open(`https://wa.me/${event.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
$('#guest-name').addEventListener('input', () => $('#guest-name').setCustomValidity(''));
if (event.date) {
  const date = getEventDate(event);
  if (date) {
    $('#event-date').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Mauritius' }).format(date);
    $('#event-day').textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Indian/Mauritius' }).format(date);
    if (event.time) {
      $('#event-time').textContent = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Indian/Mauritius' }).format(date);
      $('#countdown').hidden = false;
      const updateCountdown = () => {
        const seconds = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
        const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60];
        $('#countdown-values').replaceChildren(...values.map((value, i) => { const box = document.createElement('div'); const number = document.createElement('b'); number.textContent = String(value).padStart(2, '0'); const label = document.createElement('span'); label.textContent = ['days', 'hours', 'minutes'][i]; box.append(number, label); return box; }));
      };
      updateCountdown(); setInterval(updateCountdown, 30000);
      document.querySelectorAll('[data-calendar]').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', () => {
          const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
          const escape = s => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
          const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Vihaan Birthday//Invitation//EN','BEGIN:VEVENT',`UID:vihaan-first-birthday-${event.date}@invitation.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(date)}`,'SUMMARY:Vihaan’s first birthday',`LOCATION:${escape(event.venue)}`,'DESCRIPTION:Celebrate with Madhav and Urvashee.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
          const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
          const link = document.createElement('a'); link.href = url; link.download = 'vihaan-first-birthday.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      });
    }
  }
}
// Do not imply that a missing photograph is a photograph of the venue.
$('#venue-photo').addEventListener('error', () => { $('#venue-photo').hidden = true; $('.photo-caption').textContent = 'Paps Restaurant · Vacoas-Phoenix'; $('.photo-credit').hidden = true; });
