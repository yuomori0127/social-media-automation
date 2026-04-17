import React from "react";
import { Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "@remotion/captions";

// ── 定数 ──────────────────────────────────────────────────────────
const BASE_FONT_SIZE = 80;
const HOOK_FONT_SIZE = 96;
const MIN_FONT_SIZE = 34;
const MAX_WIDTH_RATIO = 0.86;

// 先頭 HOOK_COUNT 行をフックブロックとして一括表示する
const HOOK_COUNT = 2;

// ── フォントサイズ自動スケール ──────────────────────────────────────
function estimateTextWidth(text: string, fontSize: number): number {
  const plain = text.replace(/<[^>]*>/g, "");
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 0x7f ? fontSize * 0.92 : fontSize * 0.55;
  }
  return width;
}

export function calcFontSize(
  text: string,
  videoWidth: number,
  base: number = BASE_FONT_SIZE
): number {
  const maxWidth = videoWidth * MAX_WIDTH_RATIO;
  let size = base;
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

// ── HTMLテキストをJSXに変換 ─────────────────────────────────────────
function renderTaggedText(
  html: string,
  highlightColor: string = "#FFFF00"
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /<b>(.*?)<\/b>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > last) parts.push(html.slice(last, match.index));
    parts.push(
      <span
        key={match.index}
        style={{ color: highlightColor, textShadow: makeOutlineShadow("#000000", 4) }}
      >
        {match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < html.length) parts.push(html.slice(last));
  return parts;
}

// ── HookBlock（フック行を一括表示 — 中央・赤背景ボックス） ─────────
// HOOK_COUNT 行分のテキストを縦に積んで1つのボックスに表示する
interface HookBlockProps {
  lines: string[];
}

export const HookBlock: React.FC<HookBlockProps> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.65 },
    durationInFrames: Math.round(fps * 0.3),
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [-24, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: height * 0.27,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 28px",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          backgroundColor: "#CC0000",
          borderRadius: 12,
          paddingTop: 18,
          paddingBottom: 18,
          paddingLeft: 32,
          paddingRight: 32,
          boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {lines.map((line, i) => {
          const fontSize = calcFontSize(line, width, HOOK_FONT_SIZE);
          return (
            <span
              key={i}
              style={{
                fontSize,
                fontFamily: "'Noto Sans JP', sans-serif",
                fontWeight: 900,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                textShadow: makeOutlineShadow("#880000", 3),
                lineHeight: 1,
              }}
            >
              {renderTaggedText(line, "#FFE000")}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── SubtitlePage（通常行 — 画面下部） ──────────────────────────────
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
    const progress = spring({
      frame,
      fps,
      config: { damping: 20, stiffness: 160, mass: 0.65 },
      durationInFrames: Math.round(fps * 0.25),
    });
    opacity = interpolate(progress, [0, 1], [0, 1]);
    translateY = interpolate(progress, [0, 1], [28, 0]);
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: height * 0.22,
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
        {renderTaggedText(text)}
      </span>
    </div>
  );
};

// ── SubtitleLayer ───────────────────────────────────────────────────
interface SubtitleLayerProps {
  captions: Caption[];
  fps: number;
}

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({ captions, fps }) => {
  const hookCaptions = captions.slice(0, HOOK_COUNT);
  const bodyCaptions = captions.slice(HOOK_COUNT);

  // フックブロックは先頭行の start〜最後フック行の end まで一括表示
  const hookStartFrame = Math.round((hookCaptions[0].startMs / 1000) * fps);
  const hookEndFrame = Math.round(
    (hookCaptions[hookCaptions.length - 1].endMs / 1000) * fps
  );
  const hookDuration = Math.max(1, hookEndFrame - hookStartFrame);

  return (
    <>
      {/* フックブロック（2行まとめて表示） */}
      <Sequence from={hookStartFrame} durationInFrames={hookDuration}>
        <HookBlock lines={hookCaptions.map((c) => c.text)} />
      </Sequence>

      {/* 通常行（画面下部） */}
      {bodyCaptions.map((cap, i) => {
        const startFrame = Math.round((cap.startMs / 1000) * fps);
        const endFrame = Math.round((cap.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <SubtitlePage text={cap.text} animate={true} />
          </Sequence>
        );
      })}
    </>
  );
};
