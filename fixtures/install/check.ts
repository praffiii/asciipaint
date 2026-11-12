import { WebGLRenderer, type Camera, type Scene } from "three";
import {
  asciipaint,
  autoRender,
  type Color,
  type LiveOptions,
  type Loop,
  type Options,
  type Paint,
  type Rgb,
  type Size,
} from "asciipaint";
import { asciipaintThree, type ThreePaint } from "asciipaint/three";
import "asciipaint/element";

declare const canvas: HTMLCanvasElement;
declare const image: HTMLImageElement;
declare const scene: Scene;
declare const camera: Camera;

const rgb: Rgb = [0.96, 0.93, 0.87];
const background: Color = rgb;
const live: LiveOptions = { background: "#fff", edgeFade: 0.05, sparkle: true };
const options: Options = { cell: [2.4, 3.4], ramp: "-=+*#%@", font: "600 monospace", background };
const css: Size = { width: 120, height: 120 };

const paint: Paint = asciipaint(canvas, options);
paint.draw(image);
paint.set(live);
paint.resize(css);
paint.dispose();

const loop: Loop = autoRender(paint, (now: number) => paint.draw(image), {
  onContextLost: () => {},
});
loop.requestFrame();
loop.stop();

declare const renderer: WebGLRenderer;
const threePaint: ThreePaint = asciipaintThree(renderer, options);
threePaint.render(scene, camera);
threePaint.set(live);
threePaint.resize();
void threePaint.compile();
threePaint.dispose();

const element: CustomElementConstructor | undefined = customElements.get("ascii-img");
void element;
