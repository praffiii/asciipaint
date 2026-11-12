let region: HTMLElement | undefined;

function announce(text: string, ms?: number) {
  if (!region) {
    region = document.createElement("div");
    region.setAttribute("aria-live", "polite");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    document.body.append(region);
  }
  const live = region;
  live.textContent = text;
  if (ms) setTimeout(() => live.textContent === text && (live.textContent = ""), ms);
}

/** Makes every `[data-copy="<id>"]` button in `root` copy that element's text. */
export function wireCopy(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copy ?? "");
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.textContent ?? "");
        announce("copied", 1600);
        button.dataset.state = "copied";
        setTimeout(() => delete button.dataset.state, 1600);
      } catch {
        getSelection()?.selectAllChildren(target);
        announce("select it to copy");
      }
    });
  });
}
