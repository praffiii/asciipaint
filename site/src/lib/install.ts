import { asciipaint, autoRender } from "asciipaint";
import { wireCopy } from "./copy";
import { liquid } from "./liquid";

export const MANAGERS = {
  npm: "npm i asciipaint",
  pnpm: "pnpm add asciipaint",
  yarn: "yarn add asciipaint",
  bun: "bun add asciipaint",
} as const;

type Manager = keyof typeof MANAGERS;

const isManager = (name: string | undefined): name is Manager => !!name && name in MANAGERS;

/** The manager tabs (WAI-ARIA tabs, roving tabindex) and the live result of the three lines. */
export function install(root: ParentNode): void {
  wireCopy(root);
  wireTabs(root);
  wireDemo(root);
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

/** The three lines beside it, run for real: `asciipaint(canvas)` with every default, drawing the liquid. */
function wireDemo(root: ParentNode): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-install-demo]");
  const figure = canvas?.closest("figure");
  if (!canvas || !figure) return;
  const hide = () => (figure.dataset.fallback = "");
  if (!liquid()) return void hide();
  try {
    const paint = asciipaint(canvas);
    const dpr = Math.min(devicePixelRatio, 2);
    autoRender(
      paint,
      (now) => {
        const w = Math.round(canvas.clientWidth * dpr);
        const h = Math.round(canvas.clientHeight * dpr);
        const frame = w && h ? liquid()?.frame(now / 1000, w, h, "night") : undefined;
        if (frame) paint.draw(frame);
      },
      { onContextLost: hide },
    );
  } catch (error) {
    console.warn("asciipaint couldn't start the install demo.", error);
    hide();
  }
}
