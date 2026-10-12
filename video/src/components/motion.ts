import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Spring that starts `delay` frames into the current sequence. */
export const useSpringAt = (
  delay: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8, ...config },
  });
};

/** Eased 0→1 progress between two frames. */
export const useProgress = (from: number, to: number, easing = easeInOut) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing });
};

export type Rect = { x: number; y: number; w: number; h: number };

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** Walks a list of [frame, rect] keyframes with eased moves between them. */
export const cameraPath = (frame: number, keys: [number, Rect][]): Rect => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, r0] = keys[i];
    const [f1, r1] = keys[i + 1];
    if (frame <= f1) {
      const t = interpolate(frame, [f0, f1], [0, 1], { ...clamp, easing: easeInOut });
      return lerpRect(r0, r1, t);
    }
  }
  return keys[keys.length - 1][1];
};

export const peso = (minor: number) => "₱" + Math.round(minor).toLocaleString("en-PH");
