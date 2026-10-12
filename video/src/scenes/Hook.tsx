import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C, DISPLAY } from "../brand";
import { Background } from "../components/Background";
import { KineticText } from "../components/Kinetic";
import { clamp, easeOut } from "../components/motion";

const TOOLS = [
  { t: "Spreadsheets", x: -470, y: -250, r: -7, c: C.teal },
  { t: "Invoice app", x: 430, y: -190, r: 6, c: C.amber },
  { t: "CRM", x: -520, y: 190, r: 5, c: C.indigoBright },
  { t: "Task board", x: 470, y: 250, r: -5, c: C.plum },
  { t: "Sticky notes", x: -20, y: -10, r: -3, c: C.red },
];

const SCATTER = 62;

/** Too many tools: labels slam in, get struck out, and are blown away. */
export const Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blow = interpolate(frame, [SCATTER, SCATTER + 16], [0, 1], { ...clamp, easing: easeOut });
  const shake =
    frame > SCATTER && frame < SCATTER + 14
      ? Math.sin(frame * 3.1) * (SCATTER + 14 - frame) * 1.6
      : 0;

  return (
    <AbsoluteFill>
      <Background intensity={0.7} gridSpeed={2} />
      <AbsoluteFill
        style={{
          transform: `translate(${shake}px, ${shake * 0.6}px)`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {TOOLS.map((tool, i) => {
          const at = 4 + i * 10;
          const s = spring({
            frame: frame - at,
            fps,
            config: { damping: 11, stiffness: 200, mass: 0.6 },
          });
          const strike = interpolate(frame, [at + 10, at + 18], [0, 1], {
            ...clamp,
            easing: easeOut,
          });
          const dx = tool.x * (1 + blow * 2.2);
          const dy = tool.y * (1 + blow * 2.2);
          return (
            <div
              key={tool.t}
              style={{
                position: "absolute",
                transform: `translate(${dx}px, ${dy}px) rotate(${tool.r + blow * tool.r * 6}deg) scale(${(2.4 - 1.4 * s) * (1 - blow * 0.4)})`,
                opacity: Math.min(1, s * 1.5) * (1 - blow),
                filter: `blur(${(1 - Math.min(s, 1)) * 18 + blow * 16}px)`,
                padding: "22px 38px",
                borderRadius: 26,
                background: "rgba(255,255,255,.07)",
                border: `2px solid ${tool.c}88`,
                boxShadow: `0 0 50px ${tool.c}44`,
              }}
            >
              <span
                style={{
                  fontFamily: DISPLAY,
                  fontWeight: 700,
                  fontSize: 76,
                  color: C.white,
                  letterSpacing: "-0.03em",
                }}
              >
                {tool.t}
              </span>
              <div
                style={{
                  position: "absolute",
                  left: 24,
                  top: "52%",
                  height: 8,
                  borderRadius: 4,
                  width: `calc(${strike} * (100% - 48px))`,
                  background: C.red,
                  boxShadow: `0 0 20px ${C.red}`,
                }}
              />
            </div>
          );
        })}
        {frame >= SCATTER ? (
          <div style={{ textAlign: "center" }}>
            <KineticText text="Ang daming tools!" delay={SCATTER + 2} size={170} stagger={1.2} />
            <div
              style={{
                marginTop: 34,
                fontFamily: BODY,
                fontSize: 40,
                color: "rgba(255,255,255,.7)",
                opacity: interpolate(frame, [SCATTER + 20, SCATTER + 32], [0, 1], clamp),
                transform: `translateY(${interpolate(frame, [SCATTER + 20, SCATTER + 32], [30, 0], { ...clamp, easing: easeOut })}px)`,
              }}
            >
              Kulang na ang oras para sa negosyo mo.
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
