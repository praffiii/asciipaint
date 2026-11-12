import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ThreePaint } from "../src/three";
import { edgeColour } from "./sources";

export { asciipaintThree } from "../src/three";

export interface Stage3d {
  readonly renderer: WebGLRenderer;
  /** Advances the rotation and draws: painted through `paint`, or the raw render when it's null. */
  frame(now: number, paint: ThreePaint | null): void;
  /** The mean colour at the scene's edges, from one raw render. */
  edge(): string | null;
  /** Shows `model` (scaled to fit) in place of the primitives; null brings them back. */
  show(model: Object3D | null): void;
}

/** A few lit primitives, slowly turning, on the renderer's own canvas. */
export function stage3d(canvas: HTMLCanvasElement): Stage3d {
  const renderer = new WebGLRenderer({ canvas, antialias: false });
  // Only the raw ("before") view goes to the screen; asciipaint applies the same ACES grade itself.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color("#6F7FA8");
  scene.add(new HemisphereLight("#FFF4E0", "#3A2E4A", 1.4));
  const sun = new DirectionalLight("#FFFFFF", 3);
  sun.position.set(3, 4, 5);
  scene.add(sun);

  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.4, 6);
  camera.lookAt(0, 0, 0);

  const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.45 });
  const primitives = new Group();
  const knot = new Mesh(new TorusKnotGeometry(0.75, 0.26, 160, 24), material("#E8A93A"));
  const ball = new Mesh(new SphereGeometry(0.6, 48, 32), material("#E0482F"));
  const gem = new Mesh(new IcosahedronGeometry(0.62), material("#1F8A85"));
  ball.position.set(-1.9, -0.3, 0.2);
  gem.position.set(1.9, 0.25, -0.2);
  primitives.add(knot, ball, gem);

  const turntable = new Group();
  turntable.add(primitives);
  scene.add(turntable);

  const fit = () => {
    const c = renderer.domElement;
    renderer.setSize(c.clientWidth || 1, c.clientHeight || 1, false);
    camera.aspect = (c.clientWidth || 1) / (c.clientHeight || 1);
    camera.updateProjectionMatrix();
  };

  return {
    renderer,
    frame(now, paint) {
      const t = now / 1000;
      turntable.rotation.y = t * 0.25;
      knot.rotation.x = t * 0.4;
      gem.rotation.z = t * 0.5;
      camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
      camera.updateProjectionMatrix();
      if (paint) paint.render(scene, camera);
      else renderer.render(scene, camera);
    },
    edge() {
      fit();
      renderer.render(scene, camera);
      return edgeColour(renderer.domElement); // same task, so the drawing buffer is still there
    },
    show(model) {
      turntable.clear();
      if (!model) {
        turntable.add(primitives);
        return;
      }
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3()).length() || 1;
      model.position.sub(box.getCenter(new Vector3()));
      const holder = new Group();
      holder.add(model);
      holder.scale.setScalar(4 / size);
      turntable.add(holder);
    },
  };
}

/** Parses a dropped `.glb`, or a `.gltf` with its data embedded. */
export function parseGltf(data: ArrayBuffer): Promise<Object3D> {
  return new Promise((done, fail) => {
    new GLTFLoader().parse(data, "", (gltf) => done(gltf.scene), fail);
  });
}
