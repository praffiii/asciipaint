// Twelve original marks, each shipped twice: a viewBox-only SVG and a transparent PNG.

interface Part {
  d: string;
  fill: string;
  evenodd?: boolean;
}
interface Logo {
  name: string;
  parts: Part[];
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const diamond = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
const chevron = (y: number) =>
  `M15 ${y + 20}L50 ${y}L85 ${y + 20}L85 ${y + 34}L50 ${y + 14}L15 ${y + 34}Z`;
const wave = (y: number) =>
  `M8 ${y}Q29 ${y - 20} 50 ${y}T92 ${y}V${y + 16}Q71 ${y + 36} 50 ${y + 16}T8 ${y + 16}Z`;

export const LOGOS: Logo[] = [
  {
    name: "Orbit",
    parts: [
      { d: circle(50, 50, 40) + circle(50, 50, 26), fill: "#3A4BA8", evenodd: true },
      { d: circle(71, 29, 10), fill: "#E0482F" },
    ],
  },
  {
    name: "Chevrons",
    parts: [
      { d: chevron(8), fill: "#E8A93A" },
      { d: chevron(32), fill: "#E0482F" },
      { d: chevron(56), fill: "#8A3B78" },
    ],
  },
  {
    name: "Petals",
    parts: [
      { d: "M50 50V10A40 40 0 0 1 90 50Z", fill: "#1F8A85" },
      { d: "M50 50H90A40 40 0 0 1 50 90Z", fill: "#6FA8DC" },
      { d: "M50 50V90A40 40 0 0 1 10 50Z", fill: "#E8A93A" },
      { d: "M50 50H10A40 40 0 0 1 50 10Z", fill: "#E0482F" },
    ],
  },
  {
    name: "Hex",
    parts: [
      { d: "M50 8L86 29V71L50 92L14 71V29Z", fill: "#2F4858" },
      { d: "M50 32L70 66H30Z", fill: "#E8A93A" },
    ],
  },
  {
    name: "Tide",
    parts: [
      { d: wave(30), fill: "#6FA8DC" },
      { d: wave(58), fill: "#3A4BA8" },
    ],
  },
  {
    name: "Moon",
    parts: [
      { d: "M62 12A38 38 0 1 0 62 88A48 48 0 0 1 62 12Z", fill: "#E8A93A" },
      { d: circle(76, 34, 7), fill: "#8A3B78" },
    ],
  },
  {
    name: "Diamonds",
    parts: [
      { d: diamond(30, 30, 18), fill: "#E0482F" },
      { d: diamond(70, 30, 18), fill: "#3A4BA8" },
      { d: diamond(30, 70, 18), fill: "#1F8A85" },
      { d: diamond(70, 70, 18), fill: "#E8A93A" },
    ],
  },
  {
    name: "Dawn",
    parts: [
      { d: "M18 70A32 32 0 0 1 82 70Z", fill: "#E0482F" },
      {
        d: "M46 10H54L52 30H48Z M12 34L18 28L34 42L30 46Z M88 34L82 28L66 42L70 46Z",
        fill: "#E8A93A",
      },
      { d: "M8 76H92V88H8Z", fill: "#2B2448" },
    ],
  },
  {
    name: "Leaf",
    parts: [
      { d: "M50 6C82 30 82 70 50 94C18 70 18 30 50 6Z", fill: "#6C9A3B" },
      { d: "M48 22H52V86H48Z", fill: "#DCE8B0" },
    ],
  },
  {
    name: "Steps",
    parts: [
      { d: "M10 90V66H34V42H58V18H90V90Z", fill: "#3A4BA8" },
      { d: "M58 18H90V42H58Z", fill: "#E8A93A" },
    ],
  },
  {
    name: "Cross",
    parts: [
      { d: circle(50, 50, 42), fill: "#1F8A85" },
      { d: "M42 20H58V42H80V58H58V80H42V58H20V42H42Z", fill: "#FFFFFF" },
    ],
  },
  {
    name: "Nest",
    parts: [
      { d: diamond(50, 50, 44), fill: "#8A3B78" },
      { d: diamond(50, 50, 28), fill: "#E0482F" },
      { d: diamond(50, 50, 12), fill: "#FFD27A" },
    ],
  },
];

/** The mark as a viewBox-only SVG data URL: no width or height, like most icon exports. */
export function svgUrl(logo: Logo): string {
  const paths = logo.parts
    .map((p) => `<path d="${p.d}" fill="${p.fill}"${p.evenodd ? ' fill-rule="evenodd"' : ""}/>`)
    .join("");
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${paths}</svg>`)}`;
}

/** The mark as a 256 px transparent PNG (an object URL). */
export async function pngUrl(logo: Logo): Promise<string> {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.scale(2.56, 2.56);
  for (const p of logo.parts) {
    g.fillStyle = p.fill;
    g.fill(new Path2D(p.d), p.evenodd ? "evenodd" : "nonzero");
  }
  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, "image/png"));
  if (!blob) throw new Error(`could not encode ${logo.name}`);
  return URL.createObjectURL(blob);
}
