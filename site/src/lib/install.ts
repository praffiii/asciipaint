import { cellCanvas } from "./layers";
import { wireCopy } from "./copy";
import { liquid } from "./liquid";
import { paintStill } from "./still";

export const MANAGERS = {
  npm: "npm i asciipaint",
  pnpm: "pnpm add asciipaint",
  yarn: "yarn add asciipaint",
  bun: "bun add asciipaint",
} as const;

type Manager = keyof typeof MANAGERS;

const isManager = (name: string | undefined): name is Manager => !!name && name in MANAGERS;

/** The manager tabs (WAI-ARIA tabs, roving tabindex) and the three-layer stack. */
export function install(root: ParentNode): void {
  wireCopy(root);
  wireTabs(root);
  wireStack(root);
}

function wireTabs(root: ParentNode): void {
  const list = root.querySelector<HTMLElement>('[role="tablist"]');
  const panel = root.querySelector<HTMLElement>('[role="tabpanel"]');
  const command = root.querySelector<HTMLElement>("#install-cmd");
  if (!list || !panel || !command) return;
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];

  const select = (tab: HTMLElement, focus: boolean) => {
    const name = tab.dataset.manager;
    if (!isManager(name)) return;
    for (const t of tabs) {
      t.setAttribute("aria-selected", String(t === tab));
      t.tabIndex = t === tab ? 0 : -1;
    }
    panel.setAttribute("aria-labelledby", tab.id);
    command.textContent = MANAGERS[name];
    if (focus) tab.focus();
  };

  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab, false)));
  list.addEventListener("keydown", (event) => {
    const at = tabs.findIndex((t) => t === document.activeElement);
    if (at < 0) return;
    const last = tabs.length - 1;
    const to =
      event.key === "ArrowRight" ? (at + 1) % tabs.length
      : event.key === "ArrowLeft" ? (at + last) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : undefined;
    const tab = to === undefined ? undefined : tabs[to];
    if (!tab) return;
    event.preventDefault();
    select(tab, true);
  });
}

const CELL = [8, 11] as const;

/** One liquid frame at t = 18 becomes the picture, its cells and its glyphs, once the stack is in view. */
function wireStack(root: ParentNode): void {
  const stack = root.querySelector<HTMLElement>("#stack");
  const picture = stack?.querySelector<HTMLCanvasElement>('[data-layer="picture"]');
  const cells = stack?.querySelector<HTMLCanvasElement>('[data-layer="cells"]');
  const glyphs = stack?.querySelector<HTMLElement>('[data-layer="glyphs"]');
  if (!stack || !picture || !cells || !glyphs) return;

  const visible = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    visible.disconnect();
    const painter = liquid();
    if (!painter) return; // the layers stay as empty slabs; the labels still say it all
    const scale = Math.min(devicePixelRatio, 2);
    // Layout size: the layers are skewed, so their bounding boxes are not their sizes.
    picture.width = Math.round(picture.offsetWidth * scale);
    picture.height = Math.round(picture.offsetHeight * scale);
    picture.getContext("2d")?.drawImage(painter.frame(18, picture.width, picture.height, "night"), 0, 0);

    const flat = cellCanvas(picture, [CELL[0] * scale, CELL[1] * scale]);
    cells.width = flat.width;
    cells.height = flat.height;
    cells.getContext("2d")?.drawImage(flat, 0, 0);

    glyphs.addEventListener("paint", () => (glyphs.dataset.painted = ""), { capture: true, once: true });
    paintStill(glyphs, () => picture, { cell: CELL.join(" "), background: "#02030A" });
  });
  visible.observe(stack);
}
