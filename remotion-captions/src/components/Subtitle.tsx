import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ── フォントサイズ自動スケール ──────────────────────────────────────
const BASE_FONT_SIZE = 80;
const MIN_FONT_SIZE = 34;
const MAX_WIDTH_RATIO = 0.94;

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  // HTMLタグを除去してテキストのみで計算
  const plain = text.replace(/<[^>]*>/g, "");
  for (const ch of plain) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x7f) {
      // 全角（日本語など）
      width += fontSize * 0.92;
    } else {
      // 半角
      width += fontSize * 0.55;
    }
  }
  return width;
}

export function calcFontSize(text: string, videoWidth: number): number {
  const maxWidth = videoWidth * MAX_WIDTH_RATIO;
  let size = BASE_FONT_SIZE;
  while (size > MIN_FONT_SIZE) {
    if (estimateTextWidth(text, size) <= maxWidth) break;
    size -= 1;
  }
  return size;
}

// ── テキストシャドウ生成 ────────────────────────────────────────────
function makeOutlineShadow(color: string, px: number): string {
  const offsets = [-px, 0, px];
  const parts: string[] = [];
  for (const x of offsets) {
    for (const y of offsets) {
      if (x === 0 && y === 0) continue;
      parts.push(`${x}px ${y}px 0 ${color}`);
    }
  }
  return parts.join(", ");
}

// ── HTMLテキストをJSXに変換（<b>タグ → キーワード色） ───────────────
function renderTaggedText(
  html: string,
  fontSize: number
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /<b>(.*?)<\/b>/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > last) {
      parts.push(html.slice(last, match.index));
    }
    parts.push(
      <span
        key={match.index}
        style={{
          color: "#FFFF00",
          textShadow: makeOutlineShadow("#000000", 5),
        }}
      >
        {match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < html.length) {
    parts.push(html.slice(last));
  }
  return parts;
}

// ── SubtitlePage ────────────────────────────────────────────────────
interface SubtitlePageProps {
  text: string;
  animate: boolean;
}

export const SubtitlePage: React.FC<SubtitlePageProps> = ({ text, animate }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const fontSize = calcFontSize(text, width);

  let opacity = 1;
  let translateY = 0;

  if (animate) {
    const durationInFrames = Math.round(fps * 0.28);
    const progress = spring({
      frame,
      fps,
      config: { damping: 20, stiffness: 160, mass: 0.65 },
      durationInFrames,
    });
    opacity = interpolate(progress, [0, 1], [0, 1]);
    translateY = interpolate(progress, [0, 1], [28, 0]);
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: height * 0.08,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontSize,
          fontFamily: "'Noto Sans JP', sans-serif",
          fontWeight: 900,
          color: "#FFFFFF",
          whiteSpace: "nowrap",
          textShadow: makeOutlineShadow("#FF0000", 5),
          lineHeight: 1,
        }}
      >
        {renderTaggedText(text, fontSize)}
      </span>
    </div>
  );
};

// ── SubtitleLayer ───────────────────────────────────────────────────
import { Sequence } from "remotion";
import type { Caption } from "@remotion/captions";

interface SubtitleLayerProps {
  captions: Caption[];
  fps: number;
}

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({
  captions,
  fps,
}) => {
  return (
    <>
      {captions.map((cap, i) => {
        const startFrame = Math.round((cap.startMs / 1000) * fps);
        const endFrame = Math.round((cap.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);
        const animate = startFrame !== 0;

        return (
          <Sequence
            key={i}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <SubtitlePage text={cap.text} animate={animate} />
          </Sequence>
        );
      })}
    </>
  );
};
