# Vihaan’s Little Explorer invitation

A responsive static invitation for Vihaan’s first birthday, with locally hosted safari artwork, fonts, five animated animal companions and four sandboxed games. No backend, database, analytics, guest accounts or remote API is required.

## Preview and build

Requires Node.js 22.12+.

```
npm ci
npm run dev
npm test
npm run build
```

Publish only `dist/` to a static HTTPS host. GitHub Pages, Netlify and Vercel configurations are included. See [HOSTING.md](HOSTING.md) for publishing and security-header setup. The build supports a domain root or a repository subpath.

## Event details and RSVP

Edit `event-config.js`. The configured celebration is Sunday 6 December 2026 at 11:00 am Mauritius time, at Paps Restaurant. Run `npm run check:ready` before sharing.

The hero shows the full date, Mauritius time and venue. Every RSVP button opens the same form directly. On phones, RSVP and Directions remain available in a bottom action bar after the hero scrolls away. The RSVP section comes before Kids corner and Gaming. A sticky navigation bar keeps Invitation, Kids corner and Gaming available throughout the page, highlights the current section and moves keyboard focus to each destination. The same shortcuts appear inside games and close the game before jumping. Native section links work without JavaScript. The header reads “Vihaan” with a “First birthday” subtitle.

Guests enter a name and choose whether they can attend. Acceptances request a total headcount including the person replying and children, with an exact count for parties of six or more. Declines omit the headcount. Guests review and send the prepared message themselves in WhatsApp; the website does not send messages or claim attendance is confirmed. A copy-message fallback works when WhatsApp does not open, with manual selection if clipboard access is unavailable. Names and RSVP details are not stored. Calendar downloads use the Mauritius time zone and do not invent an event end time. Missing settings are labelled as pending.

## Artwork, motion and games

The cream, sage and terracotta palette, visibly labelled venue illustration and picture-book safari animals are retained. Reading text stays still. The header offers a Pause/Resume animations button, and the operating system’s reduced-motion preference pauses all page decorations and canvas loops. Paused ribbon phrases wrap so every message remains readable. Motion choices stay in memory for the current page. All five sprite sheets and the tiger’s rolling pose preload at page open and decode in parallel, including animals below the fold. Each animal appears only after its real artwork is painted; no emoji face or static placeholder flashes first.

Continuous in-between frames add head and neck movement, body bends, breathing, a smoother walking turn, springy monkey hops and a crouch-roll-bounce sequence for the tiger. Existing artwork stays local. Offscreen animals and page decorations behind open dialogs stop moving to avoid unnecessary work. Tapping the companions makes the lion wave, elephant splash, giraffe munch a leaf, monkey somersault or tiger roll. Paused motion shows a still response. Ordinary words have no surprise effects or extra keyboard stops.

Kids corner groups all five interactive animal companions with the birthday playground: three replenishing balloons with small star showers, a tap-to-blow-out candle with celebrating safari friends and a relight button, a pick-a-leaf/then-feed-the-giraffe activity, and five animals peeking from bushes with a picture collection and replay. All controls support touch and keyboard use. Visual instructions and status messages explain each action. The activities are silent, use local artwork and original SVG/CSS illustrations, and keep progress only in memory. Confetti and canvas reactions stop when motion is paused, the document is hidden, or a dialog opens. Reduced motion keeps every activity playable with still feedback.

Gaming contains Tap Tap Tap, Hextris, 0h h1 and Safari Flyer. Phone cards use compact illustrated previews. Scores remain inside the isolated game session and disappear when it is closed. Games never report scores, ask for nicknames or contact a service.

## Security and privacy

The invitation has no frontend runtime dependencies and makes no outbound API requests. Assets and game libraries are local. WhatsApp and Google Maps open only when a guest chooses their links. A static host may maintain access logs.

Games run in frames with `sandbox="allow-scripts"` and no same-origin, navigation, popup, forms or download privileges. They cannot read the invitation DOM or browser storage. A memory-only compatibility layer supports older game code; games have no cookies or persistent storage. Content policies block outbound fetch/XHR/WebSocket connections and external scripts. The only message games send to the invitation indicates that their start screen is ready.

The site asks search engines not to index it, but this is not access control. Event details and the WhatsApp recipient are public to anyone who can access the site. Use host access controls if needed. Vendored games are older upstream projects; preserve their isolation and content policies when editing them.

## Attribution

[public/credits.html](public/credits.html) contains licenses, attribution and downloadable complete modified game sources. After changing games, run `python3 scripts/package-game-sources.py` before building. `scripts/harden-games.py` documents the original one-time adaptation and should not be reapplied to already adapted games.

The venue card is an original SVG illustration. Google Maps provides real visitor photos; no third-party venue photograph is redistributed. Safari artwork and sprite sheets were generated with the built-in image generation tool; see [design/asset-notes.md](design/asset-notes.md) and [docs/animal-art-prompts.md](docs/animal-art-prompts.md).

## Verification

`npm test` checks assets, date validation, game content policies and absence of backend tooling. `npm run check:ready` checks event configuration.

Browser checks require installed Chrome on macOS, or `CHROME_PATH` pointing to Chrome elsewhere:

- `npm run build && npm run test:pages`: domain-root and repository-subpath loading, animal activities, smooth animation frames, eager loading without placeholder faces, missing artwork, game loading, credits and source downloads.
- With `npm run dev` running: `node scripts/invitation-check.mjs` checks direct RSVP entry points, acceptance/decline replies, exact larger-party counts, mobile quick actions, WhatsApp URL encoding, clipboard/manual fallback, pending event settings and calendar timezone. WhatsApp is mocked; no messages are sent.
- With `npm run dev` running: `node scripts/motion-check.mjs` checks responsive layouts, readable ribbon phrases, stable reading text, keyboard greetings, pause/resume, reduced-motion preferences and dialog motion.
- With `npm run preview -- --port 4173` running: `npm run test:play` checks balloons, birthday wishes and relighting, feeding order/replay, hide-and-seek/collection/replay, keyboard controls, touch targets, responsive layouts, reduced motion, cleanup and absence of external requests or saved progress. Set `TEST_URL` for another production preview URL.
- With the same production preview running: `npm run test:navigation` checks persistent, tappable tabs at 320, 390, 768 and 1440px; section grouping; keyboard focus and unobscured jump destinations; shortcuts from open games; and navigation without JavaScript.
- With `npm run preview -- --port 4173` running: `node scripts/game-check.mjs` exercises touch gameplay, replay, restart, closing, frame isolation and absence of external requests at phone and desktop widths.

These checks use browser-emulated devices, not physical-device certification.
