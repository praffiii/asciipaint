export const PALETTES: Record<"night" | "stage" | "light" | "title", readonly string[]> = {
  night: ["#02030A", "#0E1A5C", "#2440D0", "#7C5CF2", "#F0EEFF", "#3B1E9A"],
  stage: ["#0E1A5C", "#2440D0", "#5B7BFF", "#8F72FF", "#F0EEFF", "#B9A8FF"],
  light: ["#6E86FF", "#8F72FF", "#B9A8FF", "#ECE8FF", "#FFFFFF", "#C9BDFF"],
  title: ["#1A2C9A", "#2F4BE0", "#5B7BFF", "#8F72FF", "#F0EEFF", "#6A4CF0"],
};

export type Palette = keyof typeof PALETTES;

export const isPalette = (name: string | undefined): name is Palette => !!name && name in PALETTES;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** The stops as GLSL `vec3(r,g,b), …` literals, 3 decimals per channel. */
export function paletteGlsl(hexes: readonly string[]): string {
  return hexes.map((hex) => `vec3(${channels(hex).map((c) => c.toFixed(3)).join(",")})`).join(", ");
}

export interface Liquid {
  /** Renders the paint at time `t` (s) into a `w` × `h` px offscreen canvas and returns it; read it in the same task. */
  frame(t: number, w: number, h: number, palette: Palette): HTMLCanvasElement;
}

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.0-1.0,0,1); }`;

// Thick glossy paint: domain-warped fbm mapped through the palette, lit for gloss.
const FS = `#version 300 es
precision highp float; uniform vec2 R; uniform float T; uniform vec3 P[6]; out vec4 o;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
float field(vec2 p){
  vec2 q = vec2(fbm(p + T*.04), fbm(p + vec2(5.2,1.3) - T*.035));
  vec2 r = vec2(fbm(p + 3.5*q + vec2(1.7,9.2) + T*.02), fbm(p + 3.5*q + vec2(8.3,2.8)));
  return fbm(p + 3.0*r);
}
vec3 pal(float f){
  float x = clamp(f*1.7-.25,0.,.999)*5.; int i = int(x); float k = smoothstep(.35,.65,fract(x));
  return mix(P[i], P[min(i+1,5)], k);
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5*R)/R.y*2.2;
  float e = 1.5/R.y, f = field(p);
  vec2 g = vec2(field(p+vec2(e,0))-f, field(p+vec2(0,e))-f)/e;
  vec3 N = normalize(vec3(-g*.06, 1.)), L = normalize(vec3(-.5,.6,.8)), V = vec3(0,0,1);
  vec3 col = pal(f) * (.72 + .35*max(dot(N,L),0.));
  col += pow(max(dot(reflect(-L,N),V),0.), 36.) * .55;
  o = vec4(col,1);
}`;

function create(): Liquid | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VS],
    [gl.FRAGMENT_SHADER, FS],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  const uR = gl.getUniformLocation(program, "R");
  const uT = gl.getUniformLocation(program, "T");
  const uP = gl.getUniformLocation(program, "P");
  const stops = new Map(
    Object.entries(PALETTES).map(([name, hexes]) => [name, new Float32Array(hexes.flatMap(channels))]),
  );
  canvas.addEventListener("webglcontextlost", () => (shared = undefined)); // the next call starts afresh

  return {
    frame(t, w, h, palette) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, t + 40);
      const p = stops.get(palette);
      if (p) gl.uniform3fv(uP, p);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return canvas;
    },
  };
}

let shared: Liquid | null | undefined;

/** The one shared liquid painter, made on first use; null without WebGL2. */
export function liquid(): Liquid | null {
  if (shared === undefined) shared = create();
  return shared;
}
