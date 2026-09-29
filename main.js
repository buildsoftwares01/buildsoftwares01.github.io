import { setupLeaderboards } from './leaderboard.js';
import { event } from './event-config.js';
import { getEventDate } from './event-details.js';
const $ = (s) => document.querySelector(s);
const paths = { calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>', message: '<path d="m4 17-1 5 5-2a9 9 0 1 0-4-3Z"/><path d="M8 8c0 4 4 7 7 7l1-2-3-1-1 1-2-2 1-1-1-3Z"/>' };
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[el.dataset.icon]}</svg>`; });
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  document.body.classList.add('motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
const games = {
  taptaptap: { name: 'Tap Tap Tap', help: 'Tap the blue circles before time runs out. Avoid red circles. Start with New Game.' },
  flappy: { name: 'Safari Flyer', help: 'Tap to flap through the green branches. On a computer, click or press Space.' },
  hextris: { name: 'Hextris', help: 'Tap the left or right side to rotate. Match three colours. Keyboard: ← →.' },
  ohhi: { name: '0h h1', help: 'Tap tiles to change colour. Start with “How to play” for a friendly tutorial.' },
};
const gameDialog = $('#game-dialog');
let activeGame, gameTrigger;
const leaderboards = setupLeaderboards({ gameDialog, getGame: () => activeGame, getFrame: () => $('#game-frame-container iframe') });
function loadGame() {
  leaderboards.reset();
  const frame = document.createElement('iframe');
  frame.title = games[activeGame].name + ' browser game';
  // No same-origin, popups, forms, downloads, or top-level navigation privileges.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.src = `./games/${activeGame}/index.html`;
  $('#game-frame-container').replaceChildren(frame);
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
gameDialog.addEventListener('close', () => { leaderboards.reset(); $('#game-frame-container').replaceChildren(); gameTrigger?.focus(); });
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
  const message = `Hi Madhav & Urvashee! It's ${name}. We'd love to celebrate Vihaan's first birthday at Paps Restaurant. RSVP: ${count} ${count === '1' ? 'guest' : 'guests'}. Looking forward to the adventure!`;
  window.open(`https://wa.me/${event.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
$('#guest-name').addEventListener('input', () => $('#guest-name').setCustomValidity(''));
$('#share-button').addEventListener('click', async () => {
  const url = new URL(location.href); url.hash = ''; url.search = '';
  try { if (navigator.share) await navigator.share({ title: 'Vihaan is a wild ONE!', text: "You're invited to Vihaan's first birthday!", url: url.href }); else { await navigator.clipboard.writeText(url.href); toast('Invitation link copied. Share a little joy!'); } } catch (error) { if (error.name !== 'AbortError') toast('Copy the address from your browser to share this invitation.'); }
});
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
      $('#calendar-button').addEventListener('click', () => {
        const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const escape = s => s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
        const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Vihaan Birthday//Invitation//EN','BEGIN:VEVENT',`UID:vihaan-first-birthday-${event.date}@invitation.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(date)}`,'SUMMARY:Vihaan’s first birthday',`LOCATION:${escape(event.venue)}`,'DESCRIPTION:Celebrate with Madhav and Urvashee.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
        const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'vihaan-first-birthday.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    }
  }
}
// Do not imply that a missing photograph is a photograph of the venue.
$('#venue-photo').addEventListener('error', () => { $('#venue-photo').hidden = true; $('.photo-caption').textContent = 'Paps Restaurant · Vacoas-Phoenix'; $('.photo-credit').hidden = true; });
