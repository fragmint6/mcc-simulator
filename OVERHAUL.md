# MCC Simulator — Visual Overhaul Notes

Everything runs exactly as before (same physics, same formulas, same data files) — this was a
pure presentation + motion upgrade. Open `index.html` from a local web server as usual.

## What changed

### Look & feel
- Deep-regatta night design system: glassmorphism panels, per-panel accent underlines,
  tinted shadows, ambient aurora blobs drifting behind everything, subtle film grain.
- Typography: **Orbitron** (numbers, headings, badges) + **Space Grotesk** (body).
- Nav uses your existing `mclean-crew-logo.png` crest (drop your file back in, original slot kept);
  favicon points back to the original `favicon.ico`.
- Themed thin scrollbars, text selection color, keyboard focus rings.

### Race course (centerpiece)
- **Animated water canvas**: three depth-layered rolling wave sheets with crest highlights,
  drifting light sheen, twinkling glare specks, and a soft vignette. The water visibly
  speeds up while a race is LIVE, and pauses off-screen / when the tab is hidden.
- **Rebuilt boats**: gradient hulls, deck gloss, bow chevron flash, under-hull glow and
  shadow, riggers, gold cox dot, and **8 crew dots that physically slide** with the stroke.
- **Hull dynamics**: boats surge forward during the drive and pitch subtly through the
  catch/recovery; a wake ribbon swells behind each shell through every stroke.
- Bobbing lantern buoys on the lane ropes, glowing green start line, checkered finish line
  with a waving flag, and 500 m / 1000 m distance ticks aligned to the bow geometry.
- New HUD: pulsing **LIVE** badge, Orbitron **race clock**, and a live **gap chip**
  (leader + margin in meters, color-coded to the leader).
- **"ATTENTION → GO!"** full-screen countdown with sonar rings before every race.

### Motion everywhere
- Panels cascade in on page load; roster/coxswain cards rise in with a stagger.
- Cards lift and glow (rarity-colored) on hover with a sheen sweep.
- Seat assignment pops with a spring flash; loading lineups / randomizing staggers seats in.
- Win-probability bar is an animated tug-of-war with moving stripes; confidence chips kept.
- Commentary is a broadcast feed: color-coded left rails + slide-in entries.
- Telemetry charts get brand gradient fills, soft glow, and themed axes.
- Results popup: staggered stat cards, bouncing trophy, **gold crown on the winning boat**,
  and a team-colored **confetti** burst.
- Hall of Fame: gold shimmer title, halo'd icons, hover lift, spring entrances.
- All animations respect `prefers-reduced-motion`.

### First-run experience
- Boats are now seeded with a showcase matchup (top 8 vs next 8, with coxswains) so the
  win-probability bar lights up immediately on load.

## Files
- Rewritten: `index.html`, `style.css`, new `fx.js`
- Patched (visuals only): `app.js`
- Untouched: `simulation.js`, `data/*`, `docs/*`, `firebase.js`

## Round 2: glyph + alignment fixes
- **Removed** the AI-generated crest; nav/favicon restored to your original assets.
- **All mojibake glyphs replaced with real Font Awesome icons** (zero non-ASCII left in `app.js`):
  - Rarity badges: gem (Generational), star (Freak), square (Pretty Good), triangle (Mid), circle (Noob).
  - Steering readouts show a live compass needle that rotates with the heading angle.
  - List separators are now tiny dot icons; year ranges use a long-arrow icon; empty states a minus icon.
- **Reworked partial stat circles**: the fill is now a true conic pie (`--p`) inside the exact same
  circle as full/empty dots — the remainder always covers the whole shape, identically sized/positioned.
- **Icon centering pass**: close buttons are square flex-centered hit targets, result-card titles
  are flex rows, the "vs" divider is a round badge, boat dots sit on the text midline, and glyph
  line-height was normalized across buttons/headings/chips.
