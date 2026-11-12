/** Band colours by name, for code that needs the hex rather than the CSS token. */
export const TONES = {
  black: "#000000",
  violet: "#7C5CF2",
  lavender: "#ECE8FF",
  cobalt: "#2440D0",
  "violet-deep": "#4B2AA8",
  navy: "#0A0D1F",
} as const;

export type Tone = keyof typeof TONES;
