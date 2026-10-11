import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { BODY, C, DISPLAY } from "../brand";
import { Background } from "../components/Background";
import { Cursor } from "../components/Cursor";
import { Bullet, Chip, Eyebrow, KineticText } from "../components/Kinetic";
import { cameraPath, clamp, easeInOut } from "../components/motion";
import { FULL, Screen } from "../components/Screen";

// The "Loyalty app" card in the Proposal column, and where it lands in Negotiation.
const CARD = { x: 1395, y: 420, w: 390, h: 135 };
const DROP = { x: 1830, y: 590 };

const DealCard = () => (
  <div
    style={{
      width: CARD.w,
      height: CARD.h,
      borderRadius: 14,
      background: C.white,
      border: "2px solid #e3e2dc",
      padding: "18px 20px",
      boxSizing: "border-box",
      fontFamily: BODY,
    }}
  >
    <div style={{ fontSize: 22, fontWeight: 600, color: "#1d1d1b" }}>Loyalty app</div>
    <div style={{ fontSize: 18, color: "#77766f", marginTop: 2 }}>Kusina Lokal</div>
    <div
      style={{ fontSize: 30, fontWeight: 700, color: "#1d1d1b", marginTop: 8, fontFamily: DISPLAY }}
    >
      ₱180,000
    </div>
  </div>
);

/** Sales: the pipeline swings in beside the leads list and a deal is dragged a stage forward. */
export const Crm = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });
  const back = spring({ frame: frame - 6, fps, config: { damping: 15, stiffness: 70 } });
  const camera = cameraPath(frame, [
    [22, FULL],
    [52, { x: 900, y: 250, w: 1400, h: 875 }],
  ]);
  const drag = interpolate(frame, [74, 102], [0, 1], { ...clamp, easing: easeInOut });
  const lifted = interpolate(frame, [70, 76, 100, 106], [0, 1, 1, 0], clamp);
  const sway = Math.sin(frame / 25) * 3;

  return (
    <AbsoluteFill>
      <Background />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 250,
          width: 640,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <Eyebrow text="01 · CRM & sales" delay={4} />
        <KineticText
          text="Win more"
          delay={8}
          size={104}
          style={{ justifyContent: "flex-start" }}
        />
        <KineticText
          text="deals."
          delay={16}
          size={104}
          color={C.indigoBright}
          style={{ justifyContent: "flex-start", marginTop: -20 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 20 }}>
          <Bullet text="Leads, contacts and companies" delay={30} />
          <Bullet text="Drag-and-drop deal pipeline" delay={38} />
          <Bullet text="Public lead forms" delay={46} />
        </div>
      </div>
      <AbsoluteFill style={{ perspective: 2000 }}>
        <div
          style={{
            position: "absolute",
            left: 800,
            top: 120,
            transform: `translateX(${(1 - back) * 1200}px) rotateY(${-24 + sway}deg) translateZ(-260px) translate(120px, -40px)`,
            opacity: 0.85,
          }}
        >
          <Screen shot="leads" width={1150} dim={0.35} url="kasama.space/crm/leads" />
        </div>
        <div
          style={{
            position: "absolute",
            left: 760,
            top: 230,
            transform: `translateX(${(1 - enter) * 1400}px) rotateY(${-16 + sway + (1 - enter) * -40}deg)`,
          }}
        >
          <Screen
            shot="deals"
            width={1150}
            camera={camera}
            url="kasama.space/crm/deals"
            overlay={
              <>
                {frame >= 70 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: CARD.x,
                      top: CARD.y,
                      width: CARD.w,
                      height: CARD.h,
                      borderRadius: 14,
                      background: "#f1f0ea",
                      border: "3px dashed #c9c8c0",
                      boxSizing: "border-box",
                    }}
                  />
                ) : null}
                <div
                  style={{
                    position: "absolute",
                    left: CARD.x + (DROP.x - CARD.x) * drag,
                    top: CARD.y + (DROP.y - CARD.y) * drag,
                    transform: `rotate(${lifted * 4}deg) scale(${1 + lifted * 0.08})`,
                    boxShadow: `0 ${30 * lifted}px ${60 * lifted}px rgba(20,30,80,${0.35 * lifted})`,
                    borderRadius: 14,
                    opacity: frame >= 70 ? 1 : 0,
                  }}
                >
                  <DealCard />
                </div>
                <Cursor
                  scale={2.2}
                  path={[
                    [56, 1300, 900],
                    [72, CARD.x + 200, CARD.y + 70],
                    [74, CARD.x + 200, CARD.y + 70],
                    [102, DROP.x + 200, DROP.y + 70],
                    [120, DROP.x + 260, DROP.y + 200],
                  ]}
                  clickAt={72}
                />
              </>
            }
          />
        </div>
      </AbsoluteFill>
      <Chip
        text="Moved to Negotiation"
        sub="Loyalty app · ₱180,000"
        delay={106}
        color={C.teal}
        style={{ right: 90, top: 120 }}
      />
    </AbsoluteFill>
  );
};
