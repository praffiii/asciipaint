const ROW = 36;
const CX = 15;
const AMP = 7;
const STEP = 6;
const SVG = "http://www.w3.org/2000/svg";

/**
 * A cubic-Bézier path along `x(y) = cx + amp · sin(π · (y − rowH / 2) / rowH + phase)` from `y0` to `y1`
 * (at most `rows · rowH`), sampled every 6 px with tangent handles. At phase 0 it crosses `cx` mid-row.
 */
export function wavePath(rows: number, rowH: number, cx: number, amp: number, phase: number, y0: number, y1: number): string {
  const end = Math.min(y1, rows * rowH);
  const k = Math.PI / rowH;
  const x = (y: number) => cx + amp * Math.sin(k * (y - rowH / 2) + phase);
  const dx = (y: number) => amp * k * Math.cos(k * (y - rowH / 2) + phase);
  const n = (v: number) => +v.toFixed(2);
  let d = `M ${x(y0).toFixed(2)} ${n(y0)}`;
  for (let a = y0; a < end; a += STEP) {
    const b = Math.min(a + STEP, end);
    const h = (b - a) / 3;
    d += ` C ${(x(a) + h * dx(a)).toFixed(2)} ${n(a + h)}, ${(x(b) - h * dx(b)).toFixed(2)} ${n(b - h)}, ${x(b).toFixed(2)} ${n(b)}`;
  }
  return d;
}

const pad = (i: number) => String(i).padStart(2, "0");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
}

/**
 * Builds the "on this page" rail and the phone chips from `root`'s `article h2[id]`, marks the heading
 * being read (the last one whose top is above 30% of the viewport) and draws the winding progress
 * wave up to it. The wave drifts only while the rail is on screen and motion is allowed.
 */
export function toc(root: HTMLElement): void {
  const rail = root.querySelector<HTMLElement>("[data-toc]");
  const chips = root.querySelector<HTMLElement>("[data-toc-chips]");
  const heads = [...root.querySelectorAll<HTMLHeadingElement>("article h2[id]")];
  if (!rail || !chips || !heads.length) return;
  const list = rail.querySelector("ol")!;
  const svg = rail.querySelector<SVGSVGElement>("svg")!;
  const count = rail.querySelector<HTMLElement>("[data-toc-count]")!;
  const paths = {
    glow: svg.querySelector<SVGPathElement>("[data-glow]")!,
    wave: svg.querySelector<SVGPathElement>("[data-wave]")!,
    track: svg.querySelector<SVGPathElement>("[data-track]")!,
  };
  const rows = heads.length;
  const height = rows * ROW;
  svg.setAttribute("viewBox", `0 0 30 ${height}`);
  svg.setAttribute("height", String(height));

  const links: HTMLAnchorElement[] = [];
  const chipLinks: HTMLAnchorElement[] = [];
  const nodes: SVGCircleElement[] = [];
  const halo = document.createElementNS(SVG, "circle");
  halo.setAttribute("class", "halo");
  halo.setAttribute("r", "10.5");
  halo.setAttribute("cx", String(CX));
  svg.append(halo);
  heads.forEach((h, i) => {
    const title = h.textContent?.trim() ?? "";
    const li = document.createElement("li");
    const a = el("a", "toc-link");
    a.href = `#${h.id}`;
    a.append(el("span", "toc-n", pad(i + 1)), el("span", "toc-t", title));
    const tag = el("span", "toc-tag", "READING");
    tag.setAttribute("aria-hidden", "true");
    li.append(a, tag);
    list.append(li);
    links.push(a);

    const chip = el("a", "toc-chip", title);
    chip.href = `#${h.id}`;
    chips.append(chip);
    chipLinks.push(chip);

    const node = document.createElementNS(SVG, "circle");
    node.setAttribute("cx", String(CX));
    node.setAttribute("cy", String(ROW / 2 + ROW * i));
    svg.append(node);
    nodes.push(node);
  });
  chips.hidden = false;
  rail.hidden = false;

  let active = -1;
  let phase = 0;
  const draw = () => {
    const y = ROW / 2 + ROW * active;
    const done = wavePath(rows, ROW, CX, AMP, phase, 0, y);
    paths.wave.setAttribute("d", done);
    paths.glow.setAttribute("d", done);
    paths.track.setAttribute("d", wavePath(rows, ROW, CX, AMP, phase, y, height));
  };
  const mark = () => {
    const line = innerHeight * 0.3;
    let next = 0;
    heads.forEach((h, i) => {
      if (h.getBoundingClientRect().top < line) next = i;
    });
    // At the very bottom, headings too low to ever reach the line count as read.
    if (scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) next = rows - 1;
    if (next === active) return;
    active = next;
    for (const group of [links, chipLinks]) {
      group.forEach((a, i) => (i === active ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
    }
    nodes.forEach((c, i) => {
      // 9 px nodes (the hollow ones' 1.5 px stroke included), 11 px for the one being read.
      c.setAttribute("class", i < active ? "read" : i === active ? "now" : "next");
      c.setAttribute("r", i < active ? "4.5" : i === active ? "5.5" : "3.75");
    });
    halo.setAttribute("cy", String(ROW / 2 + ROW * active));
    count.textContent = `${pad(active + 1)} / ${pad(rows)}`;
    draw();
  };
  mark();
  addEventListener("scroll", mark, { passive: true });
  addEventListener("resize", mark, { passive: true });

  // Drift: only while the rail is laid out and on screen (a hidden rail never intersects) and motion is allowed.
  const motion = matchMedia("(prefers-reduced-motion: no-preference)");
  let visible = false;
  let raf = 0;
  let last = 0;
  const frame = (t: number) => {
    phase += 0.0006 * (last ? t - last : 0);
    last = t;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const run = visible && motion.matches;
    if (run && !raf) raf = requestAnimationFrame(frame);
    if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  };
  new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  }).observe(svg);
  motion.addEventListener("change", sync);
}
