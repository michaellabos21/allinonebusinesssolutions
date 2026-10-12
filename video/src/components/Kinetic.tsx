import type { CSSProperties } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C, DISPLAY } from "../brand";
import { clamp, easeOut } from "./motion";

/** Letters rise, unblur and settle one after another. */
export const KineticText = ({
  text,
  delay = 0,
  size = 120,
  stagger = 1.6,
  color = C.white,
  weight = 800,
  style,
  exitAt,
}: {
  text: string;
  delay?: number;
  size?: number;
  stagger?: number;
  color?: string;
  weight?: number;
  style?: CSSProperties;
  exitAt?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit =
    exitAt === undefined
      ? 0
      : interpolate(frame, [exitAt, exitAt + 12], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        color,
        whiteSpace: "pre",
        display: "flex",
        justifyContent: "center",
        ...style,
      }}
    >
      {[...text].map((ch, i) => {
        const s = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 12, stiffness: 160, mass: 0.6 },
        });
        const out = interpolate(exit, [0, 1], [0, 1]) * (1 + i * 0.04);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${(1 - s) * size * 0.9 - out * size}px) rotate(${(1 - s) * 18}deg) scale(${0.4 + 0.6 * s})`,
              opacity: Math.min(1, s * 1.4) * (1 - exit),
              filter: `blur(${(1 - Math.min(1, s)) * 14 + exit * 10}px)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/** Small caps label that wipes in from the left. */
export const Eyebrow = ({
  text,
  delay = 0,
  color = C.indigoBright,
}: {
  text: string;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 16], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div
      style={{
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span style={{ width: 60 * p, height: 3, background: color, display: "inline-block" }} />
      {text}
    </div>
  );
};

/** A feature line with a pop-in tick. */
export const Bullet = ({ text, delay }: { text: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 140 } });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: BODY,
        fontSize: 34,
        fontWeight: 500,
        color: "rgba(255,255,255,.88)",
        opacity: Math.min(1, s * 1.5),
        transform: `translateX(${(1 - s) * -80}px)`,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${C.indigoBright}, ${C.teal})`,
          display: "grid",
          placeItems: "center",
          transform: `scale(${s}) rotate(${(1 - s) * -90}deg)`,
          fontSize: 22,
          color: C.white,
        }}
      >
        ✓
      </span>
      {text}
    </div>
  );
};

/** Floating glass chip. */
export const Chip = ({
  text,
  sub,
  delay,
  color = C.indigoBright,
  style,
}: {
  text: string;
  sub?: string;
  delay: number;
  color?: string;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.7 },
  });
  const bob = Math.sin((frame - delay) / 14) * 8;
  return (
    <div
      style={{
        position: "absolute",
        padding: "18px 26px",
        borderRadius: 22,
        background: "rgba(255,255,255,.94)",
        boxShadow: `0 30px 60px -15px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.4), 0 0 40px ${color}55`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        transform: `translateY(${bob}px) scale(${s})`,
        opacity: Math.min(1, s * 2),
        ...style,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: color,
          boxShadow: `0 0 16px ${color}`,
        }}
      />
      <div>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 30,
            color: C.ink,
            letterSpacing: "-0.02em",
          }}
        >
          {text}
        </div>
        {sub ? (
          <div style={{ fontFamily: BODY, fontSize: 20, color: "#5d6280", marginTop: 2 }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
