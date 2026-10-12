import { interpolate, useCurrentFrame } from "remotion";

import { clamp, easeInOut, easeOut } from "./motion";

/** Arrow cursor gliding along waypoints, with a click ripple at `clickAt`. */
export const Cursor = ({
  path,
  clickAt,
  scale = 1,
}: {
  path: [frame: number, x: number, y: number][];
  clickAt?: number;
  scale?: number;
}) => {
  const frame = useCurrentFrame();
  let x = path[0][1];
  let y = path[0][2];
  for (let i = 0; i < path.length - 1; i++) {
    const [f0, x0, y0] = path[i];
    const [f1, x1, y1] = path[i + 1];
    if (frame >= f0) {
      const t = interpolate(frame, [f0, f1], [0, 1], { ...clamp, easing: easeInOut });
      x = x0 + (x1 - x0) * t;
      y = y0 + (y1 - y0) * t;
    }
  }
  const appear = interpolate(frame, [path[0][0] - 8, path[0][0]], [0, 1], clamp);
  const press =
    clickAt === undefined
      ? 0
      : interpolate(frame, [clickAt - 3, clickAt, clickAt + 5], [0, 1, 0], clamp);
  const ripple =
    clickAt === undefined
      ? 0
      : interpolate(frame, [clickAt, clickAt + 22], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: appear, pointerEvents: "none" }}>
      {clickAt !== undefined && frame >= clickAt ? (
        <div
          style={{
            position: "absolute",
            left: -70 * ripple * scale,
            top: -70 * ripple * scale,
            width: 140 * ripple * scale,
            height: 140 * ripple * scale,
            borderRadius: "50%",
            border: `${5 * scale}px solid rgba(255,255,255,.9)`,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <svg
        width={44 * scale}
        height={52 * scale}
        viewBox="0 0 22 26"
        style={{
          transform: `scale(${1 - press * 0.18})`,
          transformOrigin: "0 0",
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,.45))",
        }}
      >
        <path
          d="M1 1 L1 20 L6 15.5 L9.5 24 L13 22.5 L9.6 14.3 L16 14 Z"
          fill="#111"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
