import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C } from "../brand";
import { Background } from "../components/Background";
import { KineticText } from "../components/Kinetic";
import { cameraPath, clamp } from "../components/motion";
import { FULL, Screen } from "../components/Screen";

const Key = ({ label, at, wide }: { label: string; at: number; wide?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at + 12, fps, config: { damping: 12, stiffness: 160 } });
  const press = interpolate(frame, [at, at + 3, at + 9], [0, 1, 0], clamp);
  return (
    <div
      style={{
        width: wide ? 210 : 150,
        height: 150,
        borderRadius: 32,
        background: "linear-gradient(180deg, #ffffff, #dfe2f0)",
        boxShadow: `0 ${18 - press * 14}px 0 #9aa0c4, 0 ${40 - press * 20}px 60px rgba(0,0,0,.5)`,
        transform: `translateY(${press * 14}px) scale(${s})`,
        display: "grid",
        placeItems: "center",
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: wide ? 50 : 72,
        color: C.ink,
      }}
    >
      {label}
    </div>
  );
};

/** Search: the shortcut is pressed, the palette opens out of the screen. */
export const Search = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const keysOut = interpolate(frame, [30, 42], [0, 1], clamp);
  const screenIn = spring({ frame: frame - 30, fps, config: { damping: 14, stiffness: 90 } });
  const camera = cameraPath(frame, [
    [40, FULL],
    [70, { x: 750, y: 440, w: 900, h: 562 }],
  ]);
  return (
    <AbsoluteFill>
      <Background gridSpeed={3} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: 70,
          opacity: 1 - keysOut,
          transform: `scale(${1 + keysOut * 0.6})`,
        }}
      >
        <KineticText text="Find anything, fast." delay={0} size={92} />
        <div style={{ display: "flex", gap: 34, alignItems: "center" }}>
          <Key label="Ctrl" at={14} wide />
          <span style={{ fontFamily: BODY, fontSize: 70, color: "rgba(255,255,255,.6)" }}>+</span>
          <Key label="K" at={18} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 2000 }}>
        <div
          style={{
            transform: `scale(${0.2 + 0.8 * screenIn}) rotateX(${(1 - screenIn) * 60}deg)`,
            opacity: Math.min(1, screenIn * 2),
          }}
        >
          <Screen shot="search" width={1500} camera={camera} url="app / search" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
