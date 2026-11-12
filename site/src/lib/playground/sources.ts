import type { Object3D } from "three";
import { edgeColour } from "../edge-colour";
import { liquid } from "../liquid";

/** An error whose message is written for the reader of the page. */
export class Problem extends Error {}

// three.js is ~500 kB, so the 3D path loads only when a 3D source is picked or a model is dropped.
export type SceneModule = typeof import("../scene");
let sceneModule: Promise<SceneModule> | undefined;
export const loadScene = (): Promise<SceneModule> => (sceneModule ??= import("../scene"));

export interface FlatSource {
  kind: "liquid" | "camera" | "file";
  /** The frame to paint at `now`, for a stage `w` × `h` CSS px. Read it in the same task. */
  frame(now: number, w: number, h: number): TexImageSource;
  /** A still is drawn only when something changed, not on every frame. */
  still: boolean;
  /** The mean colour of its edge, as `#RRGGBB`; null to keep the stage black. */
  edge: string | null;
  release?: () => void;
}
export interface ThreeSource {
  kind: "three";
  model: Object3D | null;
  three: SceneModule;
}
export type Source = FlatSource | ThreeSource;

const upper = (hex: string | null) => hex?.toUpperCase() ?? null;

/** The stage palette's liquid, animated; it is designed on black, so it keeps the black paper. */
export function liquidSource(): FlatSource {
  const painter = liquid();
  if (!painter) throw new Problem("asciipaint needs WebGL2");
  return { kind: "liquid", still: false, edge: null, frame: (now, w, h) => painter.frame(now / 1000, w, h, "stage") };
}

export async function threeSource(): Promise<ThreeSource> {
  return { kind: "three", model: null, three: await loadScene() };
}

export async function camera(): Promise<FlatSource> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Problem("This page can't reach a camera here: it needs HTTPS or localhost.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Problem(
        "Camera access is blocked. Allow the camera for this page in your browser's site settings, then pick Camera again.",
      );
    }
    if (name === "NotSupportedError") {
      throw new Problem("This browser can't share a camera with the page. Pick another source.");
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      throw new Problem("No camera was found. Connect one, or pick another source.");
    }
    throw new Problem("The camera didn't start. Close other apps using it, or pick another source.");
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  const release = () => stream.getTracks().forEach((t) => t.stop());
  try {
    await video.play();
  } catch {
    release();
    throw new Problem("The camera didn't start. Pick Camera again.");
  }
  return { kind: "camera", still: false, edge: upper(edgeColour(video)), frame: () => video, release };
}

/** A dropped or browsed file: a model goes to the 3D stage, a picture is decoded locally. */
export async function dropped(file: File): Promise<Source> {
  if (/\.(glb|gltf)$/i.test(file.name)) {
    try {
      const three = await loadScene();
      return { kind: "three", model: await three.parseGltf(await file.arrayBuffer()), three };
    } catch {
      throw new Problem(
        `${file.name} couldn't be read. Drop a .glb, or a .gltf with its buffers and textures embedded.`,
      );
    }
  }
  if (!file.type.startsWith("image/")) throw new Problem("Drop an image, a .glb or a .gltf.");
  // Read into a data: URL in memory: nothing is fetched or uploaded, and an SVG stays recognisable as one.
  const img = new Image();
  img.alt = file.name;
  try {
    img.src = await dataUrl(file);
    await img.decode();
  } catch {
    throw new Problem(`${file.name} couldn't be decoded. Try a PNG, JPEG, WebP, GIF or SVG.`);
  }
  return { kind: "file", still: true, edge: upper(edgeColour(img)), frame: () => img };
}

function dataUrl(file: File): Promise<string> {
  return new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? done(reader.result) : fail(reader.error));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(file);
  });
}
