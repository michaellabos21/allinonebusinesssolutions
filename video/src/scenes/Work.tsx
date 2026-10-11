import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { C } from "../brand";
import { Background } from "../components/Background";
import { Bullet, Chip, Eyebrow, KineticText } from "../components/Kinetic";
import { cameraPath, clamp, easeInOut, easeOut } from "../components/motion";
import { FULL, Screen } from "../components/Screen";

// First three task rows: checkbox centre and the end of each title, in screenshot pixels.
const ROWS = [
  { y: 422, end: 910 },
  { y: 511, end: 978 },
  { y: 599, end: 940 },
];
const BOX_X = 567;
const LIST = { x: 480, y: 270, w: 1300, h: 812 };
const CAL = { x: 470, y: 290, w: 1340, h: 838 };

const Check = ({ y, end, at }: { y: number; end: number; at: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 220, mass: 0.5 } });
  const line = interpolate(frame, [at + 4, at + 14], [0, 1], { ...clamp, easing: easeOut });
  if (frame < at) return null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: BOX_X - 17,
          top: y - 17,
          width: 34,
          height: 34,
          borderRadius: 9,
          background: C.green,
          color: C.white,
          fontSize: 24,
          fontWeight: 800,
          display: "grid",
          placeItems: "center",
          transform: `scale(${s})`,
          boxShadow: `0 0 ${24 * s}px ${C.green}`,
        }}
      >
        ✓
      </div>
      <div
        style={{
          position: "absolute",
          left: 596,
          top: y - 2,
          height: 4,
          width: (end - 596) * line,
          background: "#555",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 590,
          top: y - 24,
          width: end - 580,
          height: 74,
          background: "rgba(255,255,255,.55)",
          opacity: line,
        }}
      />
    </>
  );
};

/** Work: tasks tick off one by one, then the card flips over to the calendar. */
export const Work = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const flip = interpolate(frame, [80, 104], [0, 180], { ...clamp, easing: easeInOut });
  const tasksCam = cameraPath(frame, [
    [14, FULL],
    [40, LIST],
  ]);
  const calCam = cameraPath(frame, [
    [100, FULL],
    [128, CAL],
  ]);
  const sway = Math.sin(frame / 22) * 3;
  const pop = interpolate(flip, [0, 90, 180], [1, 0.86, 1]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 190,
            width: 1150,
            height: 760,
            transformStyle: "preserve-3d",
            transform: `translateX(${(1 - enter) * -1400}px) rotateY(${14 + sway + flip}deg) scale(${pop})`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
            <Screen
              shot="tasks"
              width={1150}
              camera={tasksCam}
              url="app / work / tasks"
              overlay={ROWS.map((r, i) => (
                <Check key={i} y={r.y} end={r.end} at={46 + i * 9} />
              ))}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <Screen shot="calendar" width={1150} camera={calCam} url="app / work / calendar" />
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 110,
          top: 270,
          width: 560,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <Eyebrow text="02 · Projects & tasks" delay={4} color={C.teal} />
        <KineticText
          text="Keep work"
          delay={8}
          size={100}
          style={{ justifyContent: "flex-start" }}
        />
        <KineticText
          text="moving."
          delay={16}
          size={100}
          color={C.teal}
          style={{ justifyContent: "flex-start", marginTop: -20 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 20 }}>
          <Bullet text="Projects, tasks and owners" delay={30} />
          <Bullet text="List, board and calendar" delay={38} />
          <Bullet text="Overdue work stands out" delay={46} />
        </div>
      </div>
      <Chip
        text="3 tasks done"
        sub="Nice work, team"
        delay={74}
        color={C.green}
        style={{ left: 820, top: 110 }}
      />
    </AbsoluteFill>
  );
};
