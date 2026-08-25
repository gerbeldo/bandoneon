# Bandoneon

A little JavaScript application that wants to help learning the bandoneon.

**Live at <https://gerbeldo.github.io/bandoneon/>**

![Screenshot](./screenshot.png)

## Using it

- **Explore** shows one keyboard layout (side + bellows direction) with every
  note labeled, plus chord and scale overlays.
- **Practice** opens on a setup screen: pick the game (name the highlighted
  button, or find the note shown on the staff), the layouts (a side or both, a
  bellows direction or both), the scale (every note, or a major or minor key),
  the items — scheduled by the app under a daily cap of new items, the first N
  of the learning order, or every note up and back down in pitch order, one
  layout at a time — and whether accidentals are spelled as sharps, flats, or a
  random mix of the two (a key spells its own). Every answer is remembered per
  button, so scheduled sessions come back to what you miss. The setup is
  remembered between visits.

## About this fork

This is a fork of [nicokaiser/bandoneon](https://github.com/nicokaiser/bandoneon)
by [Nico Kaiser](https://kaiser.me), whose original runs at
<https://bandoneon.app>. All of the original work is his; this fork exists to
add features on top of it.

The fork has been detached from the original on GitHub, so nothing here syncs
upstream automatically and no pull request from this repository is aimed at the
original project. This section is the record of where the code came from.

To pull in later changes from the original:

    git remote add upstream https://github.com/nicokaiser/bandoneon.git
    git fetch upstream
    git merge upstream/main

## Development

    npm install
    npm run dev

The dev server runs at <http://localhost:5173>. To open it on a phone or tablet
on the same network — useful for testing the keyboard layout on a touchscreen —
bind it to your LAN:

    npm run dev -- --host

## Building

    npm install
    npm run build
    npm run preview

`npm run preview` serves the production build locally. Note that the service
worker is active there but not in `npm run dev`, so a stale page in `preview`
usually means a cached service worker rather than a broken build.

Other scripts:

| Command              | Purpose                 |
| -------------------- | ----------------------- |
| `npm test`           | Run the test suite      |
| `npm run lint`       | Lint with oxlint        |
| `npm run format`     | Format with oxfmt       |
| `npm run type-check` | Type-check with vue-tsc |

## Deployment

Pushing to `main` builds and deploys to GitHub Pages via
[`.github/workflows/build.yml`](.github/workflows/build.yml).

The site is served from the `/bandoneon/` subpath rather than a domain root, so
`base` in `vite.config.ts` and the router history base in `src/main.ts` must
stay in step with the repository name. The workflow also copies `index.html` to
`404.html`, because GitHub Pages has no rewrite rules and serves `404.html` for
unknown paths — that is what hands deep links to the client-side router.

The app is installable and works offline: a service worker keeps a copy of the
current build. After a deploy, an open copy of the app fetches the new build in
the background and shows a "New version available" bar; tap Reload to switch.
Without the tap, the new build takes over once every tab (or the home-screen
app) has been closed. GitHub's CDN caches for up to ten minutes, so a
just-finished deploy can take that long to reach the bar.

## Original author

### Nico Kaiser

- <https://bsky.app/profile/nico.kaiser.me>
- <https://kaiser.me>
- <https://github.com/nicokaiser>

## Related projects

- [Keyboard Accordion](https://github.com/taniarascia/accordion) by [taniarascia](https://github.com/taniarascia) lets you play the 3-row diatonic button accordion with your computer keyboard

## License

[MIT](LICENSE) — Copyright (c) Nico Kaiser
