import "asciipaint/element";

interface StillAttrs {
  cell?: string;
  ramp?: string;
  background?: string;
  "edge-fade"?: string;
}

/**
 * Paints `draw`'s canvas into `host` through one shared `<ascii-img>`: first when `host` is in view,
 * again (debounced) when it resizes. Returns a disposer.
 */
export function paintStill(
  host: HTMLElement,
  draw: (w: number, h: number) => HTMLCanvasElement,
  attrs: StillAttrs = {},
): () => void {
  const img = document.createElement("ascii-img");
  img.setAttribute("alt", "");
  for (const [name, value] of Object.entries(attrs)) img.setAttribute(name, value);
  let url: string | undefined;
  let painted = { w: 0, h: 0 };
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const paint = () => {
    const { width: w, height: h } = host.getBoundingClientRect();
    if (!w || !h || (w === painted.w && h === painted.h)) return;
    painted = { w, h };
    const mine = ++token;
    draw(w, h).toBlob((blob) => {
      if (!blob || mine !== token) return;
      const old = url;
      url = URL.createObjectURL(blob);
      img.setAttribute("width", String(w));
      img.setAttribute("height", String(h));
      img.setAttribute("src", url);
      if (!img.isConnected) host.append(img);
      if (old) URL.revokeObjectURL(old);
    });
  };

  const resize = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(paint, 200);
  });
  const visible = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    visible.disconnect();
    paint();
    resize.observe(host);
  });
  visible.observe(host);

  return () => {
    visible.disconnect();
    resize.disconnect();
    clearTimeout(timer);
    token++;
    img.remove();
    if (url) URL.revokeObjectURL(url);
  };
}
