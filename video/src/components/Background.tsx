import { AbsoluteFill, random, useCurrentFrame } from "remotion";

import { C } from "../brand";

const BLOBS = [
  { color: C.indigoBright, x: 0.2, y: 0.25, r: 700, sx: 0.011, sy: 0.008 },
  { color: C.teal, x: 0.85, y: 0.3, r: 560, sx: 0.009, sy: 0.012 },
  { color: C.plum, x: 0.6, y: 0.9, r: 620, sx: 0.013, sy: 0.007 },
  { color: C.indigo, x: 0.05, y: 0.95, r: 520, sx: 0.007, sy: 0.01 },
];

const DUST = Array.from({ length: 60 }, (_, i) => ({
  x: random(`dx${i}`),
  y: random(`dy${i}`),
  s: 1 + random(`ds${i}`) * 3,
  v: 0.3 + random(`dv${i}`) * 1.2,
  o: 0.15 + random(`do${i}`) * 0.5,
}));

/** Deep indigo stage: drifting colour fields, a moving perspective grid and dust. */
export const Background = ({
  intensity = 1,
  gridSpeed = 1,
}: {
  intensity?: number;
  gridSpeed?: number;
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${C.ink2} 0%, ${C.ink} 70%)`,
        overflow: "hidden",
      }}
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(b.x + Math.sin(f * b.sx + i) * 0.08) * 100}%`,
            top: `${(b.y + Math.cos(f * b.sy + i * 2) * 0.08) * 100}%`,
            width: b.r * 2,
            height: b.r * 2,
            marginLeft: -b.r,
            marginTop: -b.r,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
            opacity: 0.38 * intensity,
            filter: "blur(40px)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: "-50%",
          right: "-50%",
          bottom: "-30%",
          height: "80%",
          transform: "perspective(900px) rotateX(70deg)",
          transformOrigin: "50% 100%",
          backgroundImage:
            "linear-gradient(rgba(140,160,255,.16) 2px, transparent 2px), linear-gradient(90deg, rgba(140,160,255,.16) 2px, transparent 2px)",
          backgroundSize: "120px 120px",
          backgroundPosition: `0 ${(f * 2.4 * gridSpeed) % 120}px`,
          maskImage: "linear-gradient(to top, black 10%, transparent 90%)",
          WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 90%)",
          opacity: 0.7 * intensity,
        }}
      />
      {DUST.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.x * 100}%`,
            top: `${((d.y - (f * d.v) / 1080 + 2) % 1) * 100}%`,
            width: d.s,
            height: d.s,
            borderRadius: "50%",
            background: "#c9d2ff",
            opacity: d.o * intensity,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
