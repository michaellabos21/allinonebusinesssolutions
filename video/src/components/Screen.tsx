import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";

import { C, SHOT_H, SHOT_W } from "../brand";
import type { Rect } from "./motion";

export const FULL: Rect = { x: 0, y: 0, w: SHOT_W, h: SHOT_H };

/**
 * A screenshot in a browser window. `camera` is the part of the screenshot,
 * in screenshot pixels, that fills the window; animate it to pan and zoom.
 * `overlay` is drawn in screenshot pixels too, so it tracks the camera.
 */
export const Screen = ({
  shot,
  width,
  camera = FULL,
  url,
  overlay,
  style,
  dim = 0,
  blur = 0,
}: {
  shot: string;
  width: number;
  camera?: Rect;
  url?: string;
  overlay?: ReactNode;
  style?: CSSProperties;
  dim?: number;
  blur?: number;
}) => {
  const barH = Math.round(width * 0.028);
  const vw = width;
  const vh = width * (SHOT_H / SHOT_W);
  const k = Math.min(vw / camera.w, vh / camera.h);
  const tx = vw / 2 - (camera.x + camera.w / 2) * k;
  const ty = vh / 2 - (camera.y + camera.h / 2) * k;
  const dot = barH * 0.32;

  return (
    <div
      style={{
        width,
        borderRadius: width * 0.012,
        overflow: "hidden",
        background: C.white,
        boxShadow: "0 60px 120px -20px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.12)",
        ...style,
      }}
    >
      <div
        style={{
          height: barH,
          background: "#ecebe6",
          display: "flex",
          alignItems: "center",
          gap: dot * 0.7,
          padding: `0 ${barH * 0.5}px`,
          borderBottom: "1px solid #dddcd5",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: dot, height: dot, borderRadius: dot, background: c }} />
        ))}
        {url ? (
          <div
            style={{
              marginLeft: barH,
              flex: 1,
              maxWidth: width * 0.4,
              height: barH * 0.62,
              borderRadius: barH,
              background: C.white,
              color: "#6b6a64",
              fontSize: barH * 0.36,
              display: "flex",
              alignItems: "center",
              paddingLeft: barH * 0.5,
              fontFamily: "monospace",
            }}
          >
            {url}
          </div>
        ) : null}
      </div>
      <div style={{ position: "relative", width: vw, height: vh, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SHOT_W,
            height: SHOT_H,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${k})`,
            filter: blur ? `blur(${blur}px)` : undefined,
          }}
        >
          <Img
            src={staticFile(`screens/${shot}.png`)}
            style={{ width: SHOT_W, height: SHOT_H, display: "block" }}
          />
          {overlay}
        </div>
        {dim ? (
          <div style={{ position: "absolute", inset: 0, background: `rgba(11,16,48,${dim})` }} />
        ) : null}
      </div>
    </div>
  );
};

/** Pulsing highlight ring, in screenshot pixels. */
export const Ring = ({
  r,
  progress,
  color = C.indigoBright,
}: {
  r: Rect;
  progress: number;
  color?: string;
}) => (
  <div
    style={{
      position: "absolute",
      left: r.x - 14,
      top: r.y - 14,
      width: r.w + 28,
      height: r.h + 28,
      borderRadius: 24,
      border: `6px solid ${color}`,
      boxShadow: `0 0 0 ${12 * progress}px ${color}33, 0 0 60px ${color}88`,
      opacity: progress,
      transform: `scale(${1.15 - 0.15 * progress})`,
    }}
  />
);
