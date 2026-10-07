import { event } from './event-config.js';
import { getEventDate } from './event-details.js';
import { setupSafariFriends } from './safari-friends.js';
import { setupPlayCorner } from './play-corner.js';
const $ = (s) => document.querySelector(s);
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionToggle = $('#motion-toggle');
let guestPausedMotion = false;
function syncMotionPreference() {
  const paused = guestPausedMotion || motionPreference.matches;
  document.body.classList.toggle('motion-paused', paused);
  motionToggle.disabled = motionPreference.matches;
  motionToggle.textContent = motionPreference.matches ? 'Reduced motion enabled' : paused ? 'Resume animations' : 'Pause animations';
  motionToggle.title = motionPreference.matches ? 'Animations follow your device’s reduced-motion setting.' : '';
}
motionToggle.addEventListener('click', () => {
  guestPausedMotion = !guestPausedMotion;
  syncMotionPreference();
});
motionPreference.addEventListener('change', syncMotionPreference);
syncMotionPreference();
setupSafariFriends();
setupPlayCorner();
// Notebook bookmarks open one view at a time and remember the reader’s place.
const views = [...document.querySelectorAll('[data-page-view]')];
const sectionLinks = [...document.querySelectorAll('[data-section-link]')];
const viewHashes = { invitation: '#main', kids: '#kids-corner', gaming: '#games' };
const viewPositions = new Map();
let currentView;
const viewForHash = () => location.hash === '#kids-corner' ? 'kids' : location.hash === '#games' ? 'gaming' : 'invitation';
function showView(view, { focus = true, restore = true } = {}) {
  if ($('#game-dialog').open) {
    gameTrigger = null;
    $('#game-dialog').close();
  }
  if (currentView && currentView !== view) viewPositions.set(currentView, window.scrollY);
  currentView = view;
  document.body.dataset.view = view;
  views.forEach(panel => { panel.hidden = panel.dataset.pageView !== view; });
  sectionLinks.forEach(link => {
    if (link.hash === viewHashes[view]) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (focus) $(viewHashes[view]).focus({ preventScroll: true });
  if (restore) window.scrollTo({ top: viewPositions.get(view) || 0, behavior: 'instant' });
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname || !Object.values(viewHashes).includes(url.hash)) return;
  event.preventDefault();
  if (location.hash !== url.hash) history.pushState(null, '', url.hash);
  showView(url.hash === '#kids-corner' ? 'kids' : url.hash === '#games' ? 'gaming' : 'invitation');
});
window.addEventListener('hashchange', () => showView(viewForHash()));
showView(viewForHash(), { focus: false, restore: false });
const paths = { calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', message: '<path d="m4 17-1 5 5-2a9 9 0 1 0-4-3Z"/><path d="M8 8c0 4 4 7 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>' };
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[el.dataset.icon]}</svg>`; });
if ('IntersectionObserver' in window) {
  document.body.classList.add('motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
// Pause decorations behind dialogs so guests can concentrate on the task.
function syncDialogMotion() {
  const open = !!document.querySelector('dialog[open]');
  document.body.classList.toggle('motion-dialog', open);
}
new MutationObserver(syncDialogMotion).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
const mobileActions = $('#mobile-actions');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    mobileActions.hidden = entry.isIntersecting || entry.boundingClientRect.top >= 0;
  }).observe($('.hero'));
}
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
function loadGame() {
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
gameDialog.addEventListener('close', () => { clearGameLoading(); $('#game-frame-container').replaceChildren(); gameTrigger?.focus(); });
const rsvpDialog = $('#rsvp-dialog');
const rsvpReady = /^[1-9]\d{7,14}$/.test(event.whatsappNumber);
const guestAttendance = $('#guest-attendance');
const guestCount = $('#guest-count');
const guestTotal = $('#guest-total');
function syncRSVPFields() {
  const attending = guestAttendance.value === 'yes';
  const largeParty = attending && guestCount.value === '6+';
  $('#guest-party').hidden = !attending;
  guestCount.disabled = !attending;
  $('#guest-large-party').hidden = !largeParty;
  guestTotal.disabled = !largeParty;
  guestTotal.required = largeParty;
}
guestAttendance.addEventListener('change', syncRSVPFields);
guestCount.addEventListener('change', syncRSVPFields);
syncRSVPFields();
let rsvpTrigger;
document.querySelectorAll('[data-rsvp]').forEach(button => button.addEventListener('click', () => {
  rsvpTrigger = button;
  $('#rsvp-form').hidden = !rsvpReady;
  $('#rsvp-unavailable').hidden = rsvpReady;
  $('#rsvp-fallback').hidden = true;
  rsvpDialog.showModal();
  if (rsvpReady) $('#guest-name').focus();
}));
if (!rsvpReady) $('#rsvp-note').textContent = 'WhatsApp RSVP details coming soon';
$('#close-rsvp').addEventListener('click', () => rsvpDialog.close());
rsvpDialog.addEventListener('close', () => rsvpTrigger?.focus({ preventScroll: true }));
$('#rsvp-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!rsvpReady) return;
  const name = $('#guest-name').value.trim();
  if (!name) { $('#guest-name').setCustomValidity('Please enter your name.'); $('#guest-name').reportValidity(); return; }
  const count = guestCount.value === '6+' ? guestTotal.value : guestCount.value;
  const reply = guestAttendance.value === 'yes'
    ? `We'd love to celebrate Vihaan's first birthday at Paps Restaurant. Total attending: ${count} ${count === '1' ? 'guest' : 'guests'}. Can’t wait for cake and birthday adventures!`
    : `Sorry, we can't make it to Vihaan's first birthday. Sending Vihaan lots of love for his big day!`;
  const message = `Hi Madhav & Urvashee! It's ${name}. ${reply}`;
  $('#rsvp-message').value = message;
  $('#rsvp-status').textContent = 'Your reply is ready. Send your message in WhatsApp to finish your RSVP.';
  $('#copy-status').textContent = '';
  $('#rsvp-fallback').hidden = false;
  window.open(`https://wa.me/${event.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
$('#rsvp-form').addEventListener('input', () => {
  $('#guest-name').setCustomValidity('');
  $('#rsvp-fallback').hidden = true;
});
$('#copy-rsvp').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#rsvp-message').value);
    $('#copy-status').textContent = 'Message copied. Paste it into WhatsApp and send it to Madhav & Urvashee.';
  } catch {
    $('#rsvp-message').focus();
    $('#rsvp-message').select();
    $('#copy-status').textContent = 'Select and copy the message above, then paste it into WhatsApp.';
  }
});
const eventDate = getEventDate(event);
if (!eventDate) {
  $('#event-date').textContent = 'Date coming soon';
  $('#event-day').textContent = 'A lovely day together';
}
if (!eventDate || !event.time) $('#event-time').textContent = 'Time coming soon';
$('#hero-date').textContent = eventDate
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Indian/Mauritius' }).format(eventDate)
  : 'Date coming soon';
$('#hero-time').textContent = eventDate && event.time
  ? new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Indian/Mauritius' }).format(eventDate) + ' · Mauritius time'
  : 'Time coming soon';
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
