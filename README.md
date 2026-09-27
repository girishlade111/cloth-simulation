# Cloth Simulation

An interactive cloth physics simulation in the browser — a verlet-integration cloth rendered on HTML canvas that you can drag, tear, and blow around with wind. Built with Next.js and React.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwindcss)

## What it does

This app renders a realistic cloth (a grid of points connected by distance constraints) on an HTML `<canvas>` and simulates it in real time using **verlet integration** — the classic cloth-simulation technique. The cloth hangs from its pinned top edge, sways with gravity and wind, and you can grab it with the mouse, rip it apart in tear mode, and tune the physics with live sliders. A `MeshGradient` shader backdrop (from `@paper-design/shaders-react`) gives it a striking animated background.

## Features

- 🧵 **Verlet cloth physics** — point grid + constraint relaxation, pinned top edge, gravity, friction, damping
- 🖱️ **Mouse interaction** — grab and drag the cloth, with configurable interaction radius
- ✂️ **Tear mode** — rip the cloth apart by dragging through it
- 💨 **Wind simulation** — adjustable wind strength, direction, and turbulence
- 🎚️ **Live physics controls** — sliders for gravity, friction, damping, wind; toggles for showing points/constraints
- ⏯️ **Play / pause / reset** — control the simulation loop
- 🌓 **Dark / light mode** — theme toggle via `next-themes`
- ⚡ **Static site** — exports to fully static HTML, deployable anywhere

## Tech stack

| Layer       | Tech                                              |
|-------------|---------------------------------------------------|
| Framework   | Next.js 15 (App Router, static export)            |
| UI library  | React 19                                          |
| Language    | TypeScript 5                                      |
| Rendering   | HTML Canvas 2D + verlet integration (custom code) |
| Background  | `@paper-design/shaders-react` MeshGradient        |
| Styling     | Tailwind CSS 3 + shadcn/ui (sliders, switches, cards, accordion) |
| Icons       | Lucide React                                      |

## Quick start

**Prerequisites:** Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev
# Open http://localhost:3000
```

**Build a static site:**

```bash
npm run build
# Static output is generated in ./out — serve it with any static host
npx serve out
```

## Project structure

```
.
├── app/
│   ├── layout.tsx        # Root layout, theme provider, global styles
│   ├── page.tsx          # Cloth simulation page (canvas + controls)
│   └── globals.css
├── components/
│   ├── theme-provider.tsx
│   └── ui/               # shadcn/ui primitives (slider, switch, card, accordion, button)
├── lib/
│   └── utils.ts
├── public/               # Static assets
├── next.config.mjs       # Static export config (output: 'export')
└── tailwind.config.ts
```

All simulation logic lives in `app/page.tsx`: the `ClothSimulation` class (points, constraints, verlet step, mouse handlers) and the control panel wiring.

## How the physics works

- The cloth is a grid of points (`clothWidth × clothHeight`), each connected to its neighbors by distance constraints.
- Every frame: apply gravity + wind forces, integrate positions with verlet (`x += (x - oldX) * friction`), then relax constraints several iterations so distances hold.
- The top row of points is pinned; the rest swing freely.
- Mouse drag moves the nearest point (or, in tear mode, removes constraints within `tearRadius`).

## Environment variables

None required — everything runs client-side.

## Deployment

The app is configured with `output: 'export'`, so `npm run build` produces a static site in `out/` that can be deployed to any static host:

- **Cloudflare Pages:** `cloudflare pages_deploy cloth-simulation out/`
- **Vercel / Netlify / GitHub Pages:** point at the `out/` directory after `npm run build`

## License

MIT — free to use and modify.

---

Built by Girish Lade · [ladestack.in](https://ladestack.in)
