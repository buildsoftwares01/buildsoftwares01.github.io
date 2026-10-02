# Vihaan's Little Explorer invitation

A responsive, static birthday invitation with custom safari artwork, local fonts, an illustrated venue card, Maps directions, WhatsApp RSVP preparation, share button, and sandboxed open-source games.

## Preview and build

See `HOSTING.md` for the complete publishing steps. `npm run check:ready` identifies missing event details before launch.

Requires Node.js 22.12+ (including the Cloudflare tooling).

```
npm ci
npm run dev
npm run build
```

Publish only `dist/` to a static HTTPS host. Do not publish the project directory, dependencies, development server, or environment files. Netlify and Vercel configurations are included; Cloudflare Pages can use `npm run build`, output `dist`, and the included `_headers`. For another host, configure the equivalent headers from `public/_headers`. Confirm response headers after deployment because static hosts differ in header support.

## GitHub Pages

A deployment workflow is included in `.github/workflows/deploy.yml`. Push to `main` and select **GitHub Actions** in the repository’s **Settings → Pages**. See `HOSTING.md` for setup and local checks. The same build supports repository subpaths and custom domains.

## Event details

Edit `event-config.js`:
- Date: Sunday 6 December 2026.
- Start time: 11:00 am, Mauritius UTC+04:00.
- WhatsApp recipient: +230 5786 4984 (stored as international digits without `+`).

The final four games are Tap Tap Tap, Hextris, 0h h1, and Safari Flyer (an adaptation of Floppy Bird). 2048 has been removed.

Calendar download buttons are available in the hero, countdown and RSVP sections. The message strap loops continuously; a pause control stops decorative animations, and reduced-motion settings show all strap text without scrolling.

Hover, tap or use Enter/Space on the coloured words and playful accents for a comic ‘BOOM!’: a layered starburst, bold lettering, smoke puffs and flying stars. The word squashes, disappears and bounces back without shifting the sentence. Bursts fit the viewport, clear after playing or scrolling, and respect pause and reduced-motion settings.

Ten original 3D safari companions, covering eight species, are scattered along both page edges. Their species and side offsets shuffle once per visit, and their homes stay anchored to the document. The articulated models walk in circles with a four-leg gait, turn in 3D, lower their heads to eat, tuck their legs to sleep, and hop after a toy ball. Tapping or using Enter/Space triggers a turn toward the viewer and a forward leap with a ‘BOO!’ bubble. Pause, reduced motion and offscreen visibility stop movement. Three.js is bundled locally in a lazy-loaded module; a single shared WebGL renderer draws only visible companions. Devices without WebGL retain accessible animal buttons with emoji artwork.

The invitation labels missing details honestly. RSVP opens an explanatory dialog until a number is configured. The countdown and calendar download appear only after a valid date and time are configured. No invented event end time is added to the calendar.

## Security and privacy

Three.js is the only frontend runtime dependency and is bundled locally. No analytics or advertising. Optional shared leaderboards use Cloudflare Workers and D1; see `LEADERBOARDS.md` for setup, moderation, data retention and limitations. Only the public Worker URL belongs in the frontend; no Cloudflare credentials are shipped. Fonts and game assets are local. Games use `sandbox="allow-scripts"` with no same-origin, top navigation, forms, popups or downloads permissions. Games cannot read the invitation DOM or storage. A memory-only compatibility layer supports old games without allowing cookies or persistent browser storage. Their CSP blocks fetch/XHR/WebSocket connections and external scripts. Parent scripts use a CSP without inline-script or eval permissions. Only the invitation can connect to the configured Cloudflare Worker; games cannot. Third-party game CSS requires inline styles inside the isolated frames.

Only fixed game identifiers can select an iframe path. The WhatsApp number is validated, names are length-limited, and the entire RSVP message is URL-encoded. No message is sent automatically. External links use `noopener noreferrer`.

The site asks search engines not to index it, but this is not access control. A public invitation and configured WhatsApp recipient can be read by anyone with access to the site. Use host-level access control if the invitation must be private. The host may keep request logs.

The two new games are silent. Safari Flyer retains the upstream Floppy Bird mechanics with original CSS artwork, text scores, and no original Flappy Bird art or audio. Tap Tap Tap uses pointer events to avoid duplicate touch/click actions. Game sources were reviewed and stripped of telemetry; they are older upstream projects, not a guarantee of vulnerability-free code. Keep sandbox restrictions and CSP in place. No server security claims can be verified until a host is configured.

## Attribution

`public/credits.html` includes licenses, attribution and complete downloadable source archives for the modified games. When changing vendored games, run `python3 scripts/package-game-sources.py` before `npm run build` to regenerate these archives. `scripts/harden-games.py` documents the one-time adaptation of pristine upstream game sources; do not repeatedly apply it to already adapted files.

The venue card is an original SVG illustration. The Google Maps link provides real venue photos; no third-party venue photograph is redistributed. See `design/asset-notes.md` for image-generation details.

## Verification

`npm test` checks game assets and source security settings. For touch integration checks, run `npm run build`, start `npm run preview -- --port 4173`, then run `node scripts/game-check.mjs`. The browser check uses installed Chrome on macOS by default; set `CHROME_PATH` to your browser executable on another system. It exercises scoring, rotation, tile changes, flapping, replay, closing and frame isolation, rejects external requests and console errors, and checks page overflow at 320, 768 and 1440 pixels. These are browser-emulated phone tests, not physical-device certification.

`npm run test:pages` checks root/subpath loading, ten scattered document-anchored animal homes, rendered 3D movement, complete animal routines, tap/keyboard surprises, pause and reduced motion, mobile overflow, and game loading.

`node scripts/motion-check.mjs` checks mobile and desktop overflow, visibility of every scrolling phrase, pause/resume, and the reduced-motion layout against `npm run dev`.

`node scripts/invitation-check.mjs` tests the actual, pending and configured RSVP states, URL encoding, the Mauritius calendar timezone, and sharing against `npm run dev`. Temporary event settings and a mocked WhatsApp navigation are used only inside the test browser; no messages are sent.

## Shared game leaderboards

Each finished round offers optional nickname entry. Arcade games rank points; 0h h1 ranks solve time separately for 4, 6, 8 and 10 tiles per side, excluding tutorials. Only the best result per browser and board is kept. See `LEADERBOARDS.md` to connect the database. Rankings are explicitly unavailable until configured; no pretend shared/local fallback is used.

`npm test` also runs the Worker and D1 locally in Miniflare to check API access, name filtering, ranking and duplicate submissions. `npm run test:leaderboards` exercises all four games in Chrome and uses that Worker and database through intercepted test API requests, including a separate browser guest.
