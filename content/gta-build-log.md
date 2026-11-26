# Build log: what went wrong (and how we caught it)

Bugsy's portfolio was built with Claude Code. Most of it worked first time. These didn't, and every one was caught by **looking at real screenshots** (headless Edge at desktop and phone sizes), not by trusting the code.

| # | What was wrong | How we caught it | Fix |
|---|---|---|---|
| 1 | The palm trees were missing. One wide SVG layer used `preserveAspectRatio="slice"`, which scaled it up and pushed both palms off the edges of the screen. | Desktop screenshot: sunset, skyline, no palms. | One small SVG per palm, pinned to the left and right edges. |
| 2 | A tiny yellow box peeked out at the top of the page. The hidden "cheat activated" toast was only moved up, not hidden. | Desktop screenshot, top centre. | Hide it with `visibility` until it's shown. |
| 3 | On phones the tagline ran off the screen ("Fixes… eventu"). A flex item won't shrink below its content unless you let it. | Phone screenshot (390 × 844). | `min-width: 0; flex: 1` on the hero text. (That screenshot was partly fooled by #8, but the fix is still correct.) |
| 4 | The Konami code failed with Caps Lock on: the browser reports `B` and `A`, not `b` and `a`. | Reading the key handler during review. | Lower-case single letters before comparing. |
| 5 | The classic "step through the code, reset on a wrong key" Konami detector breaks if you press ↑ three times. | Tested in Node before writing the site. | Keep the last 10 keys and compare the end. |
| 6 | Minimap labels ("Skills", "Missions") were cut off: the round map has `overflow: hidden`, which also clips anything that sticks out. | Desktop screenshot of the skills section. | Show the label in its own element above the map. |
| 7 | Four mission cards in a three-column grid left one orphan card on its own row. | Desktop screenshot of the missions section. | A 2 × 2 grid on desktop, one column on phones. |
| 8 | Screenshots themselves lied at first: headless Edge won't make a window narrower than about 500 px, so the "phone" shot was a cropped wider page, and jumping to `#skills` didn't scroll. | The phone shot looked bigger than a phone; section shots came out blank. | Playwright with real phone emulation (390 × 844) and scripted scrolling. |
