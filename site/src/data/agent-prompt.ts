/** The prompt the "copy prompt" buttons hand to a coding agent. `site` is the origin the docs are served from. */
export const agentPrompt = (site: string) => `Add asciipaint to this project: a library that paints an image, video, canvas or three.js scene as coloured ASCII glyphs on WebGL2.

1. Settle the brief: what gets painted (the source), where it goes on the page, and the colour behind it. Ask me for whichever of the three my request leaves out.
2. Install asciipaint with this project's package manager.
3. Pick one entry point by source:
   - A still image or logo: import "asciipaint/element", then use <ascii-img src alt width height> in place of <img>. It takes its background from the page.
   - A video, a canvas, or anything that moves: asciipaint(canvas, options) from "asciipaint", with autoRender(paint, () => paint.draw(source)) as the frame loop.
   - A three.js scene: asciipaintThree(renderer) from "asciipaint/three", with paint.render(scene, camera) where renderer.render was. Needs three 0.170 or newer.
4. Read ${site}/llms-full.txt for the exact API of the entry point you picked. The library is new, so these docs are the only reliable source for its options and methods.
5. Wire it up so that each of these that applies holds:
   - It runs in client-side code (useEffect, onMount, an Astro island).
   - The canvas has a CSS width and height.
   - background is the colour behind the canvas.
   - Geist Mono is loaded, or font names a monospace font the page already loads.
   - A source from another origin is served with CORS headers and loaded with crossOrigin = "anonymous".
   - Unmounting calls loop.stop() and paint.dispose().
   - asciipaint() sits in a try/catch that shows the plain source when WebGL2 is missing.
6. Done when the project's type check and build pass, every applicable line of step 5 holds, and you've told me where to look to see it painted.`;
