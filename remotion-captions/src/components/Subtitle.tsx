import React from "react";
import { Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "@remotion/captions";

// ── フォントサイズ自動スケール ──────────────────────────────────────
const BASE_FONT_SIZE = 80;
const HOOK_FONT_SIZE = 100;
const MIN_FONT_SIZE = 34;
const MAX_WIDTH_RATIO = 0.88;

function estimateTextWidth(text: string, fontSize: number): number {
  const plain = text.replace(/<[^>]*>/g, "");
  let width = 0;
  for (const ch of plain) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 0x7f ? fontSize * 0.92 : fontSize * 0.55;
  }
  return width;
}

export function calcFontSize(text: string, videoWidth: number, base: number = BASE_FONT_SIZE): number {
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

// ── HTMLテキストをJSXに変換（<b>タグ → キーワード色） ───────────────
function renderTaggedText(html: string, highlightColor: string = "#FFFF00"): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /<b>(.*?)<\/b>/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > last) parts.push(html.slice(last, match.index));
    parts.push(
      <span key={match.index} style={{ color: highlightColor, textShadow: makeOutlineShadow("#000000", 4) }}>
        {match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < html.length) parts.push(html.slice(last));
  return parts;
}

// ── アニメーション共通 ──────────────────────────────────────────────
function useEntryAnimation(animate: boolean, fromY: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!animate) return { opacity: 1, translateY: 0 };
  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 180, mass: 0.6 }, durationInFrames: Math.round(fps * 0.25) });
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [fromY, 0]),
  };
}

// ── HookPage（フック行 — 画面中央・赤背景ボックス） ────────────────
interface HookPageProps { text: string; animate: boolean; }

export const HookPage: React.FC<HookPageProps> = ({ text, animate }) => {
  const { width, height } = useVideoConfig();
  const fontSize = calcFontSize(text, width, HOOK_FONT_SIZE);
  const { opacity, translateY } = useEntryAnimation(animate, -24);

  return (
    <div
      style={{
        position: "absolute",
        top: height * 0.30,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "0 24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#CC0000",
          borderRadius: 10,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 28,
          paddingRight: 28,
          boxShadow: "0 6px 24px rgba(0,0,0,0.55)",
        }}
      >
        <span
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
          {renderTaggedText(text, "#FFE000")}
        </span>
      </div>
    </div>
  );
};

// ── SubtitlePage（通常行 — 画面下部） ──────────────────────────────
interface SubtitlePageProps { text: string; animate: boolean; }

export const SubtitlePage: React.FC<SubtitlePageProps> = ({ text, animate }) => {
  const { width, height } = useVideoConfig();
  const fontSize = calcFontSize(text, width, BASE_FONT_SIZE);
  const { opacity, translateY } = useEntryAnimation(animate, 28);

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
        {renderTaggedText(text)}
      </span>
    </div>
  );
};

// ── SubtitleLayer ───────────────────────────────────────────────────
// HOOK_COUNT 行目までは HookPage、それ以降は SubtitlePage で表示
const HOOK_COUNT = 2;

interface SubtitleLayerProps { captions: Caption[]; fps: number; }

export const SubtitleLayer: React.FC<SubtitleLayerProps> = ({ captions, fps }) => {
  return (
    <>
      {captions.map((cap, i) => {
        const startFrame = Math.round((cap.startMs / 1000) * fps);
        const endFrame = Math.round((cap.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, endFrame - startFrame);
        const animate = startFrame !== 0;
        const isHook = i < HOOK_COUNT;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            {isHook
              ? <HookPage text={cap.text} animate={animate} />
              : <SubtitlePage text={cap.text} animate={animate} />
            }
          </Sequence>
        );
      })}
    </>
  );
};
