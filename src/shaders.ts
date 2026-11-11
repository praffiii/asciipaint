import { LEAD } from "./atlas";

/** One full-screen triangle from gl_VertexID, so no buffers are needed. */
export const QUAD_VERT = /* glsl */ `#version 300 es
void main() {
  gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
}`;

/**
 * Pass 1, one fragment per cell (a 3·cols × rows target): the first block stores each cell's
 * average colour and brightness, the second its brightest sample, the third its coverage (mean alpha).
 * With uAlpha on, each premultiplied sample is composited over the background first; with it off
 * (three.js) samples are taken as they are and coverage is 1.
 */
export const CELL_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc;
uniform vec2 uCells;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uLod;
uniform float uAces;
uniform float uExposure;
uniform vec3 uBackground;
uniform float uAlpha;
out vec4 outColor;

// three.js's ACES filmic fit, so the print matches the prototype's grade.
vec3 rrt(vec3 v) { return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
vec3 aces(vec3 c) {
  const mat3 i = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 o = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(o * rrt(i * (c * uExposure / 0.6)), 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec2 fc = floor(gl_FragCoord.xy);
  float block = fc.x >= 2.0 * uCells.x ? 2.0 : fc.x >= uCells.x ? 1.0 : 0.0;
  vec2 cell = vec2(fc.x - block * uCells.x, fc.y); // rows counted from the bottom
  vec3 sum = vec3(0.0);
  vec4 best = vec4(0.0);
  float cover = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 uv = (cell * 2.0 + vec2(float(k - (k / 2) * 2), float(k / 2)) + 0.5) / (uCells * 2.0);
    vec4 s = textureLod(uSrc, uOffset + uv * uScale, uLod);
    vec3 c = uAlpha > 0.5 ? s.rgb + (1.0 - s.a) * uBackground : s.rgb;
    if (uAces > 0.5) c = srgb(aces(c));
    sum += c;
    cover += s.a;
    float l = luma(c);
    if (l > best.a) best = vec4(c, l);
  }
  if (block == 2.0) outColor = vec4(uAlpha > 0.5 ? cover / 4.0 : 1.0);
  else outColor = block == 1.0 ? best : vec4(sum / 4.0, luma(sum / 4.0));
}`;

/** Pass 2, every device pixel: one lookup per cell, then the glyph from the atlas. */
export const DRAW_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D tCells;
uniform sampler2D tAtlas;
uniform vec2 uCells;
uniform vec2 uSize;
uniform float uDpr;
uniform vec3 uPaper;
uniform float uSparkle;
uniform float uFeather;
uniform vec2 uCell;
uniform float uSlots;
uniform float uGlyphW;
uniform float uAtlasH;
out vec4 outColor;

vec4 cellAt(vec2 cell, int side) {
  ivec2 c = ivec2(clamp(cell, vec2(0.0), uCells - 1.0));
  return texelFetch(tCells, ivec2(c.x + side, int(uCells.y) - 1 - c.y), 0);
}
vec4 tintAt(vec2 cell) { return cellAt(cell, 0); }
vec4 hotAt(vec2 cell) { return cellAt(cell, int(uCells.x)); }
float coverAt(vec2 cell) { return cellAt(cell, 2 * int(uCells.x)).r; }
float hash(vec2 cell) { return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453); }
float glyph(float slot, vec2 f) { return texelFetch(tAtlas, ivec2(floor((slot + ${LEAD}.0 + f.x) * uGlyphW), floor(f.y * uAtlasH)), 0).a; }

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr; // CSS px from the top left
  vec2 cell = floor(px / uCell);
  vec2 f = fract(px / uCell);
  vec2 centre = (cell + 0.5) * uCell;
  float fade = uFeather == 0.0 ? 1.0 : clamp(min(min(centre.x, uSize.x - centre.x), min(centre.y, uSize.y - centre.y)) / uFeather, 0.0, 1.0);
  if (cell.x >= uCells.x || cell.y >= uCells.y || hash(cell) >= min(fade, coverAt(cell))) { outColor = vec4(uPaper, 1.0); return; }

  vec4 tint = tintAt(cell);
  vec4 hot = hotAt(cell);

  // A bright isolated point: a bright glyph in its own colour, so it sparkles instead of averaging away.
  if (uSparkle > 0.5 && hot.a > 0.55 && hot.a - tint.a > 0.2) {
    vec3 base = mix(uPaper, tint.rgb * 0.9, 0.7);
    outColor = vec4(mix(base, hot.rgb, glyph(hot.a > 0.8 ? uSlots + 1.0 : uSlots, f)), 1.0);
    return;
  }
  // Like a screen: dark gaps and bright glyph strokes, denser where the source is brighter.
  float index = min(floor(tint.a * uSlots), uSlots - 1.0);
  vec3 colour = mix(tint.rgb * 0.55, min(tint.rgb * 1.15, 1.0), glyph(index, f));

  // A soft glow spilling from lit neighbours.
  if (uSparkle > 0.5) {
    for (int dy = -1; dy <= 1; dy++)
      for (int dx = -1; dx <= 1; dx++) {
        if (dx == 0 && dy == 0) continue;
        vec4 h = hotAt(cell + vec2(float(dx), float(dy)));
        if (h.a > 0.55) colour += h.rgb * 0.08 * (1.0 - length(f - 0.5 - vec2(float(dx), float(dy)) * 0.5));
      }
  }
  outColor = vec4(colour, 1.0);
}`;
