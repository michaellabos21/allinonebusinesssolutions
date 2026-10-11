# Launch video

A 41-second, 1920×1080, 30 fps launch video built with [Remotion](https://www.remotion.dev). It is its own package and does not touch the app's dependencies.

```bash
cd video
npm install
npm run studio   # preview and scrub in the browser
npm run render   # writes out/launch-video.mp4
```

If Remotion cannot download its own headless Chrome, point it at one you have:
`REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render`.

## Scenes

| # | Scene | What moves |
| --- | --- | --- |
| 1 | Hook | "Spreadsheets / Invoice app / CRM…" slam in, get struck out, blow away; "Too many tools." |
| 2 | Reveal | Four tiles assemble into the mark, ring burst, name and tagline |
| 3 | Dashboard | Overview flies in on a 3D arc, camera dives to open invoices, then the payments chart |
| 4 | CRM | Deals board beside leads; a cursor drags a deal from Proposal to Negotiation |
| 5 | Work | Tasks tick off, the window flips over to the calendar |
| 6 | Money | Estimates and expenses fan out, payment is recorded, the PAID stamp lands |
| 7 | Reports | Screen tilts in while the headline figures count up |
| 8 | Search | Ctrl + K keycaps press, the search palette zooms in |
| 9 | Wall | Every screen streaming past on a tilted plane |
| 10 | Outro | Mark, name, the five areas and a "Now live" badge |

Timings live at the top of `src/LaunchVideo.tsx`; the product name and tagline in `src/brand.ts`.

## Screenshots

`public/screens/` are captures of the real app screens at 1600×1000 with device scale 1.5 (2400×1500 files), filled with the fictional sample records from `src/mocks`. All names, companies and amounts in them are made up. To refresh them after a UI change, capture the same routes at the same size and keep the file names; the zoom regions in each scene are in screenshot pixels, so a layout change may need those rectangles adjusted.

Fonts are the app's own (Bricolage Grotesque and Hanken Grotesk, SIL Open Font License), bundled in `public/fonts` so rendering needs no network.

## Sound

`public/audio/music.mp3` is an original 120 BPM track in A minor, and `public/audio/sfx.mp3` holds the effects (whooshes on transitions, the deal grab and drop, task ticks, the payment click and stamp, the key presses, chip pops). Both are synthesised from scratch by `scripts/make-soundtrack.py`, so nothing is sampled and there is no third-party audio to license. The music is timed to the cuts: a hit on the reveal, the groove starts with the dashboard, it breaks down for search, drops on the wall and resolves on the outro.

```bash
python3 scripts/make-soundtrack.py   # needs numpy and ffmpeg; rewrites both files
```

Timings in the script are video frames; if you change scene lengths in `src/LaunchVideo.tsx`, update them there too. Volumes are set on the two `<Audio>` tags in `src/LaunchVideo.tsx`. To use a licensed track instead, drop it in `public/audio/` and point the music `<Audio>` at it.
