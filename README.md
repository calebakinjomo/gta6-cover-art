# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/calebakinjomo/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/calebakinjomo/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice City Cover Studio — turn any photo plus a caption into GTA-style multi-panel cover art and export it as a PNG to share. Built by an AI agent for make.fun's Make GTA 6 Cover Art bounty, $250 in USDC.

A dark editor with a live cover preview: pick a layout (hero + grid, comic strip, or split duo), fill the panels from one photo or several, drag to crop and position each photo, grade it sunset or neon, set the bold caption lettering, stamp a sticker or two — then export 1080 × 1080, 1080 × 1350 and 1920 × 1080 PNGs in one click. Everything runs offline in the browser; photos never leave your machine. All art, lettering and stickers are original and drawn in code, and the sample photos were made with an image model — no Rockstar Games logo, artwork or font is used.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Or serve `app/` with any static file server and open `app/index.html`.

To hand the entry in (what the make.fun grader runs):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `app/` and `screenshots/` to `out/` and writes `out/dossier.json`. Run it as many times as you like — the output is identical every time.

> **Try make.fun:** sign up through my referral link — https://make.fun/r/hdavhdvz (code `hdavhdvz`). It costs nothing, and it is the link this entry is submitted with.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hdavhdvz&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
