import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { C } from "../brand";
import { clamp, easeOut } from "./motion";

const TILES = [
  { x: 0, y: 0, from: [-600, -400], color: C.white },
  { x: 1, y: 0, from: [600, -380], color: "#c9d2ff" },
  { x: 0, y: 1, from: [-560, 420], color: "#9fe3dc" },
  { x: 1, y: 1, from: [620, 400], color: C.white },
];

/** Four tiles fly in and lock into one mark: four tools, one place. */
export const LogoMark = ({ delay = 0, size = 180 }: { delay?: number; size?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = spring({ frame: frame - delay - 14, fps, config: { damping: 11, stiffness: 120 } });
  const tile = size * 0.3;
  const gap = size * 0.08;
  const pad = (size - tile * 2 - gap) / 2;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(140deg, ${C.indigoBright}, ${C.indigo} 55%, #26337a)`,
        boxShadow: `0 0 ${80 * lock}px ${C.indigoBright}aa, inset 0 2px 0 rgba(255,255,255,.3)`,
        transform: `scale(${0.6 + 0.4 * lock}) rotate(${(1 - lock) * -45}deg)`,
        opacity: Math.min(1, lock * 2),
      }}
    >
      {TILES.map((t, i) => {
        const s = spring({
          frame: frame - delay - i * 3,
          fps,
          config: { damping: 13, stiffness: 110 },
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pad + t.x * (tile + gap),
              top: pad + t.y * (tile + gap),
              width: tile,
              height: tile,
              borderRadius: tile * 0.3,
              background: t.color,
              transform: `translate(${t.from[0] * (1 - s)}px, ${t.from[1] * (1 - s)}px) rotate(${(1 - s) * 180}deg)`,
            }}
          />
        );
      })}
    </div>
  );
};

/** Expanding rings and sparks around a point. */
export const Burst = ({
  delay = 0,
  color = C.indigoBright,
}: {
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  if (t < 0) return null;
  return (
    <>
      {[0, 6, 12].map((d, i) => {
        const p = interpolate(t - d, [0, 40], [0, 1], { ...clamp, easing: easeOut });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 900 * p,
              height: 900 * p,
              marginLeft: -450 * p,
              marginTop: -450 * p,
              borderRadius: "50%",
              border: `${4 - i}px solid ${color}`,
              opacity: (1 - p) * 0.9,
            }}
          />
        );
      })}
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + random(`a${i}`) * 0.3;
        const dist = 200 + random(`d${i}`) * 420;
        const p = interpolate(t, [0, 34], [0, 1], { ...clamp, easing: easeOut });
        const len = 30 + random(`l${i}`) * 50;
        return (
          <div
            key={`s${i}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: len * (1 - p * 0.7),
              height: 4,
              borderRadius: 2,
              background: i % 3 === 0 ? C.teal : i % 3 === 1 ? color : C.white,
              transform: `rotate(${a}rad) translateX(${dist * p}px)`,
              transformOrigin: "0 50%",
              opacity: 1 - p,
            }}
          />
        );
      })}
    </>
  );
};
