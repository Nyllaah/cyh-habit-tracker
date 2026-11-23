# Journey

A mobile-first walking and running tracker. Everyday distance advances a virtual
journey between real cities and builds a passport of collectible stamps.

The retention bet is the growing journey: the next city gives today's activity a
nearby destination, while collected places and the activity calendar make return
visits feel cumulative. The concept can be evaluated through repeat visits after
the first arrival and sustained walking days; the demo does not collect analytics.

## Run locally

Use Node 22, then:

```bash
npm install && npm run dev
```

Open [localhost:3000](http://localhost:3000). No account, API key, or setup service is required.

## Try the daily moment

- The page opens before Alexandria is reached. Tap “Sync activity” when ready to simulate a Health Connect reading and unlock its stamp. “Demo” identifies the source.
- Edit today's total to replace the imported distance; switch between meters/kilometers and miles.
- Choose a starting city or use browser location. Previously earned stamps remain, and only unfinished checkpoint distance carries over.
- Explore the monthly calendar, swipe through the yearly grid, and expand the passport inline.

## How it works

`app/page.tsx` holds one in-memory journey reducer. `lib/data.ts` loads the sample
account and offline city catalog. Pure functions calculate effective daily distance,
route progress, history colors, and the passport; components render those results.
Changes flow through the reducer, so the map, calendar, and rewards share the same
activity records. There is no backend or separate history store.

City lookup uses Photon with a four-second timeout and a local fallback. Location
chooses the origin; it does not measure walks. City-to-city distances are straight-line
segments on an illustrated map, not walking directions. Browser geolocation needs
permission and a secure context (localhost works).

The demo uses a fixed November 22, 2026 sample day, with three recorded days and an on-demand health reading. Earlier
dates are unrecorded, and refreshing resets local state. Native health access,
persistence, authentication, and payments are outside the current implementation.

Run `npm test`, `npm run lint`, and `npm run build` for verification. The complete
requirements, decisions, implementation notes, and validation are in [the feature
plan](docs/plan.md). Original SVG artwork and design studies are documented in the
[asset handoff](design/journey/game/README.md). Development assistance used Codex and
project-local skills; [skill provenance and licenses](docs/skills.md) are retained.

<details>
<summary>Original challenge brief</summary>

# Design Engineer take-home

Thanks for making it this far. This is the part we care about most, and it's small
on purpose. Everything you need is right here in this repo, and your work stays
yours.

## What to build

The main daily moment of an app that helps someone stick with one daily goal. That's
the screen where they do the thing each day, mark it done, and get a little sense of
progress that makes them want to come back tomorrow. Just that one screen. You don't
need to build the rest of the app.

You pick the goal: learning a language, saving money, winding down for sleep, a small
creative habit, whatever you like. We want to see what you choose and why.

Build it in `app/page.tsx`. Design for a phone first, since that's how we'll look at
it. Making it responsive for desktop too is up to you.

## The thing I really want you to get

This kind of app only makes money as a subscription, and we don't make a cent until
someone sticks around for about three billing cycles (five is where it really pays
off). People don't stay because we nag them. They stay because they got hooked on one
thing early, something they'd miss if it disappeared.

So pick the one thing you think people would get hooked on, and build the daily moment
around it. Tell me where you're placing that bet.

## A few rules

- Start from this scaffold, don't rebuild it from scratch. We use the same starting
  point for everyone, and we'll build on your version together later, so keep it
  runnable.
- Data's up to you. There's a sample file at `data/sample.json` to use and reshape, or
  if it fits your idea, pull from a free external API (word of the day, quotes, FX rates,
  whatever). Showing some REST chops is a plus. Two rules either way: don't stand up your
  own backend, database, or auth, and keep it running for us out of the box, so nothing
  that needs an API key or a signup we'd have to create, and have it fall back gracefully
  if the API is slow or down. Interactions like checking a thing off or a streak ticking
  up can just live in local state.
- Plan for about 5 hours. Please don't go way over. If you've got bigger ideas, jot
  them down instead of building them.

Skip whatever doesn't matter here: no sign-in, no real payments (just show where a paid
feature would go), no empty states or edge cases. A small, clean, working thing beats a
big fragile one every time.

## Running it

```bash
npm install && npm run dev
```

It opens at http://localhost:3000 and reloads as you edit. Use Node 22 if you can
(there's an `.nvmrc`).

## Sending it back

Work in your own copy (clone it, or hit "Use this template"). Please don't push to this
repo or open a PR against it.

When you're done, email me at jamieson@chooseyourhorizon.com with either a zip of your
project (skip `node_modules`) or a link to your own repo. Make sure it still runs with
one command, since we'll build on it together in a short live session. Deploying it
somewhere like Vercel is optional, a nice bonus but we don't score it.

Send a quick note on your thinking too: what you looked at for inspiration, what you
chose and why, the one thing you're betting people get hooked on, and what you'd measure
or test to know it's working. A short write-up or a Loom under 5 minutes is perfect. And
tell me what tools you used, including AI. We use it, and using it well is a plus.

## How we'll look at it

Mostly the design: is it clear, nice to use on a phone, and does it actually make you
want to come back? We also care that it's built with some consistency instead of random
one-off styles, that your product bet makes sense, and that we can run it and follow
your thinking.

If anything's unclear, just email me before you start. Honestly, a good question counts
in your favor.

Have fun with it, and be creative. I'm excited to see what you come up with. And don't
skip the write-up, that's how I get a feel for the way you think.

Jamieson

</details>
