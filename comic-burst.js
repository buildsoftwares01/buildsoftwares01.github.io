// A short, silent cartoon impact drawn in SVG so it stays crisp on every screen.
const activeBursts = new Set();
const ink = '#30241e';
const starburst = 'M160 35 183 60 217 30 221 65 268 52 252 86 292 105 265 125 289 158 248 157 251 196 215 181 198 217 172 185 145 211 137 180 96 202 101 167 54 174 72 140 29 122 66 103 45 68 94 78 98 40 132 66Z';

export function clearComicBursts() {
  for (const dispose of activeBursts) dispose();
}

export function comicBurst(accent) {
  const rect = accent.getBoundingClientRect();
  const width = Math.min(300, window.innerWidth - 32);
  const height = width * .75;
  const burst = document.createElement('span');
  burst.className = 'accent-comic-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.width = `${width}px`;
  burst.style.height = `${height}px`;
  // Keep the whole comic panel visible, including words near screen edges.
  const clamp = (value, size, limit) => Math.max(size / 2 + 8, Math.min(limit - size / 2 - 8, value));
  burst.style.left = `${clamp(rect.left + rect.width / 2, width, window.innerWidth)}px`;
  burst.style.top = `${clamp(rect.top + rect.height / 2, height, window.innerHeight)}px`;
  const puffs = Array.from({ length: 8 }, (_, i) => {
    const angle = i * Math.PI / 4;
    const x = 160 + Math.cos(angle) * 104, y = 120 + Math.sin(angle) * 72;
    return `<g class="comic-puff" data-x="${x - 160}" data-y="${y - 120}"><path d="M${x - 18} ${y + 5}c-17-5-13-22 0-23 0-15 24-20 29-5 20-4 25 20 9 26 2 16-24 21-29 7-7 5-19 4-20-5Z" fill="#fff8e6" stroke="${ink}" stroke-width="2.5"/></g>`;
  }).join('');
  const shards = Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6;
    const x = 160 + Math.cos(angle) * 138, y = 120 + Math.sin(angle) * 101;
    const shape = i % 3 === 0
      ? `<path d="m${x} ${y - 10} 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/>`
      : `<path d="m${x - 3} ${y - 8} 9 3-5 13-5-4Z"/>`;
    return `<g class="comic-shard" data-x="${x - 160}" data-y="${y - 120}" fill="${i % 2 ? '#f5b72e' : '#df452b'}" stroke="${ink}" stroke-width="2" stroke-linejoin="round">${shape}</g>`;
  }).join('');
  burst.innerHTML = `<svg viewBox="0 0 320 240" focusable="false" aria-hidden="true">
    <g class="comic-ring"><ellipse cx="160" cy="120" rx="90" ry="64" fill="none" stroke="#e7a23a" stroke-width="5"/></g>
    ${puffs}${shards}
    <g class="comic-impact" stroke="${ink}" stroke-width="4" stroke-linejoin="round">
      <path d="${starburst}" fill="${ink}" transform="translate(4 7)"/>
      <path d="${starburst}" fill="#ec5631"/>
      <path d="${starburst}" fill="#ffda4c" transform="translate(160 120) scale(.82) translate(-160 -120)" stroke-width="3"/>
      <g fill="#c8772e" stroke="none" opacity=".35">${Array.from({ length: 21 }, (_, i) => `<circle cx="${100 + i % 7 * 20}" cy="${82 + Math.floor(i / 7) * 34}" r="2"/>`).join('')}</g>
    </g>
    <g class="comic-lettering"><text x="160" y="143" text-anchor="middle" class="comic-boom-shadow">BOOM!</text><text x="156" y="138" text-anchor="middle" class="comic-boom">BOOM!</text></g>
  </svg>`;
  (accent.closest('dialog') || document.body).append(burst);
  const animations = [];
  const animate = (target, frames, options) => {
    const animation = target.animate(frames, { duration: 1150, fill: 'both', ...options });
    animations.push(animation);
  };
  animate(burst.querySelector('.comic-impact'), [
    { transform: 'rotate(-18deg) scale(0)', opacity: 0 },
    { transform: 'rotate(5deg) scale(1.12, .94)', opacity: 1, offset: .18 },
    { transform: 'rotate(-4deg) scale(.96, 1.05)', offset: .3 },
    { transform: 'rotate(0deg) scale(1)', opacity: 1, offset: .44 },
    { transform: 'rotate(0deg) scale(1.03)', opacity: 1, offset: .7 },
    { transform: 'rotate(7deg) scale(1.2)', opacity: 0 },
  ], { easing: 'linear' });
  animate(burst.querySelector('.comic-lettering'), [
    { transform: 'rotate(-16deg) scale(0)', opacity: 0 },
    { transform: 'rotate(-10deg) scale(0)', opacity: 0, offset: .08 },
    { transform: 'rotate(-7deg) scale(1.25)', opacity: 1, offset: .24 },
    { transform: 'rotate(-7deg) scale(1)', opacity: 1, offset: .38 },
    { transform: 'rotate(-7deg) scale(1)', opacity: 1, offset: .76 },
    { transform: 'rotate(4deg) scale(1.15)', opacity: 0 },
  ], { easing: 'ease-out' });
  animate(burst.querySelector('.comic-ring'), [
    { transform: 'scale(.2)', opacity: 0 },
    { opacity: .7, offset: .12 },
    { transform: 'scale(1.5)', opacity: 0 },
  ], { duration: 600, easing: 'ease-out' });
  burst.querySelectorAll('.comic-puff, .comic-shard').forEach((particle, i) => {
    const x = Number(particle.dataset.x), y = Number(particle.dataset.y);
    animate(particle, [
      { transform: `translate(${-x * .7}px, ${-y * .7}px) scale(.1)`, opacity: 0 },
      { opacity: 1, offset: .2 },
      { transform: 'translate(0, 0) scale(1)', opacity: .9, offset: .55 },
      { transform: `translate(${x * .07}px, ${y * .07}px) rotate(${i % 2 ? 25 : -25}deg) scale(.6)`, opacity: 0 },
    ], { duration: 800 + i % 3 * 90, delay: 35 + i % 4 * 15, easing: 'ease-out' });
  });
  const dispose = () => {
    animations.forEach(animation => animation.cancel());
    burst.remove();
    activeBursts.delete(dispose);
  };
  activeBursts.add(dispose);
  Promise.allSettled(animations.map(animation => animation.finished)).then(dispose);
}
