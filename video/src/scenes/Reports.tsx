import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C, DISPLAY } from "../brand";
import { Background } from "../components/Background";
import { Eyebrow, KineticText } from "../components/Kinetic";
import { cameraPath, clamp, easeOut, peso } from "../components/motion";
import { FULL, Screen } from "../components/Screen";

// The figures shown on the Reports screenshot (fictional sample data, last 6 months).
const KPIS = [
  { label: "Collected", value: 640000, color: C.teal, bar: 0.79 },
  { label: "Invoiced", value: 813000, color: C.indigoBright, bar: 1 },
  { label: "Expenses", value: 44400, color: C.amber, bar: 0.12 },
];

const Kpi = ({ label, value, color, bar, at }: (typeof KPIS)[number] & { at: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 120 } });
  const count = interpolate(frame, [at, at + 36], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div
      style={{
        padding: "26px 34px",
        borderRadius: 28,
        background: "rgba(255,255,255,.07)",
        border: "1px solid rgba(255,255,255,.14)",
        backdropFilter: "blur(10px)",
        transform: `translateX(${(1 - s) * 300}px) scale(${0.8 + 0.2 * s})`,
        opacity: Math.min(1, s * 1.5),
      }}
    >
      <div
        style={{ fontFamily: BODY, fontSize: 26, color: "rgba(255,255,255,.7)", fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 76,
          color: C.white,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {peso(value * count)}
      </div>
      <div
        style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.1)", marginTop: 10 }}
      >
        <div
          style={{
            height: 10,
            borderRadius: 5,
            width: `${bar * count * 100}%`,
            background: color,
            boxShadow: `0 0 20px ${color}`,
          }}
        />
      </div>
    </div>
  );
};

/** Reports: the screen tilts in while the headline numbers count up beside it. */
export const Reports = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const camera = cameraPath(frame, [
    [20, FULL],
    [60, { x: 480, y: 270, w: 1800, h: 1125 }],
    [110, { x: 500, y: 500, w: 1400, h: 875 }],
  ]);
  const sway = Math.sin(frame / 24) * 2.5;
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: "absolute",
            left: 70,
            top: 200,
            transform: `translateY(${(1 - enter) * 900}px) rotateY(${18 + sway}deg) rotateX(${4 + (1 - enter) * 30}deg)`,
          }}
        >
          <Screen shot="reports" width={1180} camera={camera} url="kasama.space/reports" />
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 70,
          display: "flex",
          alignItems: "baseline",
          gap: 40,
        }}
      >
        <Eyebrow text="04 · Reports" delay={2} color={C.plum} />
      </div>
      <div style={{ position: "absolute", left: 110, top: 108 }}>
        <KineticText
          text="See the numbers."
          delay={6}
          size={76}
          style={{ justifyContent: "flex-start" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 210,
          width: 540,
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        {KPIS.map((k, i) => (
          <Kpi key={k.label} {...k} at={22 + i * 12} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
