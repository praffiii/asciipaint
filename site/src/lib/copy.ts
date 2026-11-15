let region: HTMLElement | undefined;
const wired = new WeakSet<HTMLElement>();

/** One empty live region, in the page before anything is announced into it. */
function liveRegion(): HTMLElement {
  if (!region?.isConnected) {
    region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    document.body.append(region);
  }
  return region;
}

function announce(text: string, ms?: number) {
  const live = liveRegion();
  live.textContent = text;
  if (ms) setTimeout(() => live.textContent === text && (live.textContent = ""), ms);
}

/** Shows `text` in `label`, coming out of a short blur so the swap reads as one change, not a cut. */
function swap(label: HTMLElement, text: string) {
  label.textContent = text;
  label.animate([{ opacity: 0.3, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 200, easing: "ease" });
}

/** Makes every `[data-copy="<id>"]` button in `root` copy that element's text; safe to call again. */
export function wireCopy(root: ParentNode): void {
  liveRegion();
  root.querySelectorAll<HTMLElement>("[data-copy]").forEach((button) => {
    if (wired.has(button)) return; // a second call over the same buttons must not copy twice
    wired.add(button);
    // A label that changes while the button says "copied": `<span data-copied="[ copied ]">[ copy ]</span>`.
    const label = button.querySelector<HTMLElement>("[data-copied]");
    const idle = label?.textContent ?? "";
    let reset: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copy ?? "");
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.textContent ?? "");
        announce("copied", 1600);
        if (label && !button.dataset.state) swap(label, label.dataset.copied ?? idle);
        button.dataset.state = "copied";
        clearTimeout(reset);
        reset = setTimeout(() => {
          delete button.dataset.state;
          if (label) swap(label, idle);
        }, 1600);
      } catch {
        getSelection()?.selectAllChildren(target);
        announce("select it to copy");
      }
    });
  });
}
