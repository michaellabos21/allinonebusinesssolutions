import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C, DISPLAY } from "../brand";
import { Background } from "../components/Background";
import { Cursor } from "../components/Cursor";
import { Chip, Eyebrow, KineticText } from "../components/Kinetic";
import { cameraPath, clamp, easeOut } from "../components/motion";
import { FULL, Screen } from "../components/Screen";

const CLICK = 110;
const FOCUS = { x: 1150, y: 150, w: 1200, h: 750 };

const Patch = ({
  x,
  y,
  w,
  h,
  children,
  align = "left",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children: React.ReactNode;
  align?: "left" | "right";
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.white,
      display: "flex",
      alignItems: "center",
      justifyContent: align === "right" ? "flex-end" : "flex-start",
      fontFamily: BODY,
      fontSize: 21,
      color: "#1d1d1b",
    }}
  >
    {children}
  </div>
);

/** Money: estimates and expenses fan out behind an invoice, payment is recorded and the stamp lands. */
export const Money = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 75 } });
  const fan = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 70 } });
  const camera = cameraPath(frame, [
    [24, FULL],
    [70, FOCUS],
    [140, FOCUS],
    [166, FULL],
  ]);
  const paid = frame >= CLICK + 2;
  const stamp = spring({
    frame: frame - CLICK - 6,
    fps,
    config: { damping: 9, stiffness: 180, mass: 0.7 },
  });
  const shake =
    frame > CLICK + 6 && frame < CLICK + 18
      ? Math.sin(frame * 2.7) * (CLICK + 18 - frame) * 1.2
      : 0;
  const flash = interpolate(frame, [CLICK + 1, CLICK + 3, CLICK + 12], [0, 0.5, 0], clamp);
  const titleOut = interpolate(frame, [60, 74], [0, 1], { ...clamp, easing: easeOut });

  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 70,
          opacity: 1 - titleOut,
          transform: `translateY(${-titleOut * 60}px)`,
        }}
      >
        <Eyebrow text="03 · Invoices, estimates & expenses" delay={2} color={C.amber} />
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          perspective: 2200,
          transform: `translate(${shake}px, ${shake * 0.5}px)`,
        }}
      >
        {[
          { shot: "estimates", side: -1 },
          { shot: "expenses", side: 1 },
        ].map(({ shot, side }) => (
          <div
            key={shot}
            style={{
              position: "absolute",
              transform: `translate(${side * 520 * fan}px, ${60 + (1 - fan) * 500}px) rotateZ(${side * 9 * fan}deg) rotateY(${side * -18}deg) scale(0.78)`,
              opacity: fan,
            }}
          >
            <Screen shot={shot} width={1150} dim={0.45} url={`kasama.space/money/${shot}`} />
          </div>
        ))}
        <div
          style={{
            transform: `translateY(${(1 - enter) * 1000 + 40}px) rotateX(${(1 - enter) * 40}deg) scale(${0.8 + enter * 0.1})`,
          }}
        >
          <Screen
            shot="invoice"
            width={1340}
            camera={camera}
            url="kasama.space/money/invoices/INV-1036"
            overlay={
              <>
                {paid ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: 690,
                        top: 222,
                        width: 82,
                        height: 36,
                        borderRadius: 8,
                        background: "#e3f4ea",
                        color: C.green,
                        fontFamily: BODY,
                        fontWeight: 600,
                        fontSize: 20,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      Paid
                    </div>
                    <Patch x={1800} y={402} w={410} h={42}>
                      Paid in full.
                    </Patch>
                    <Patch x={2040} y={518} w={160} h={34} align="right">
                      ₱42,000
                    </Patch>
                    <Patch x={2040} y={558} w={160} h={34} align="right">
                      <b>₱0</b>
                    </Patch>
                  </>
                ) : null}
                <div
                  style={{
                    position: "absolute",
                    left: 1240,
                    top: 470,
                    padding: "18px 60px",
                    border: `12px solid ${C.green}`,
                    borderRadius: 26,
                    color: C.green,
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 170,
                    letterSpacing: "0.08em",
                    background: "rgba(255,255,255,.75)",
                    transform: `rotate(-14deg) scale(${3 - 2 * stamp})`,
                    opacity: frame >= CLICK + 6 ? Math.min(1, stamp * 1.6) : 0,
                  }}
                >
                  PAID
                </div>
                <Cursor
                  scale={2}
                  path={[
                    [78, 1500, 820],
                    [106, 2110, 238],
                    [130, 2180, 340],
                  ]}
                  clickAt={CLICK}
                />
              </>
            }
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.white, opacity: flash }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 60,
          opacity: interpolate(frame, [130, 142], [0, 1], clamp),
        }}
      >
        <KineticText text="Get paid. Know where it went." delay={130} size={64} />
      </div>
      <Chip
        text="Payment recorded"
        sub="₱42,000 · INV-1036"
        delay={CLICK + 10}
        color={C.green}
        style={{ right: 80, top: 90 }}
      />
    </AbsoluteFill>
  );
};
