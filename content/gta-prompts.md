# Build a GTA 6-style portfolio with Claude Code: the prompts

Live demo: https://bytebuddy-dev.github.io/gta6-style-portfolio/
Full code: https://github.com/bytebuddy-dev/gta6-style-portfolio

Paste these into Claude Code one at a time, in an empty folder. Swap in your own name, skills and projects.
Plain HTML, CSS and JavaScript: no framework, no build step.

---

## 1. The plan

```
Build me a one-page developer portfolio styled like an open-world crime game
(synthwave Miami vibe: purple sky, big sunset, palm trees, neon pink and yellow).
Plain HTML, CSS and JS in index.html, style.css and main.js. No framework, no build step.

Sections:
- Hero: my name huge with a neon glow, a one-line tagline, two buttons
  ("Start mission" → projects, "Check wanted level" → skills).
- Wanted level: my skills as cards, each rated with 5 stars.
- Missions: my projects as numbered mission cards with tags and a status
  badge ("In progress" / "Mission passed").
- Hire me: a contact form.

Before writing code, show me the file structure and the colour palette.
```

## 2. The hero

```
Make the hero feel like a game title screen:
- A synthwave sunset (sun with horizontal stripes), a city skyline, a neon road grid.
- Palm tree silhouettes on the left and right edges.
- Parallax on scroll: set one CSS variable (--scroll) from JS and let each layer
  move at its own speed with transform. Keep it smooth (requestAnimationFrame).
- Respect prefers-reduced-motion: no parallax for those users.
```

## 3. Game UI

```
Add game UI details:
- A round minimap fixed in the bottom-left corner that works as the navigation.
  One blip per section; the current section's blip turns pink and the arrow points at it.
- Skill stars light up one by one when the section scrolls into view (IntersectionObserver).
- Mission cards get comic-style halftone dots made with a single radial-gradient.
- When the contact form is submitted, show a big "MISSION PASSED" overlay with "+ RESPECT"
  underneath, like the game. Don't send the form anywhere: it's a demo.
```

## 4. Cheat codes

```
Add cheat codes. Keep the last 10 key presses in a buffer and check whether the buffer
ENDS with a code (don't step through the code and reset on a wrong key: that breaks when
someone presses ↑ three times). Lower-case single letters so Caps Lock doesn't break it.
Ignore key presses while typing in the form.

- HESOYAM: every skill jumps to five stars, with a toast "Cheat activated".
- ↑ ↑ ↓ ↓ ← → ← → B A: party mode, the whole site changes colour. Type it again to stop.
- SHIPIT: the mascot launches off the screen.

Phones have no keyboard, so add tappable "cheat cards" that trigger the same cheats.
```

## 5. Check it with real screenshots (the important one)

```
Don't trust the code: look at the page. Use Playwright to take screenshots at
1440×900 (desktop) and 390×844 with real phone emulation, scrolling to every section.
Look at every screenshot and fix anything that is cut off, hidden, overflowing or
missing. List what you found and what you changed.
```

That last prompt caught 8 bugs in our build, including missing palm trees, a cheat code
that broke with Caps Lock and text running off the screen on phones.

Made by @bytebuddydev · more free resources: https://github.com/bytebuddy-dev/resources
