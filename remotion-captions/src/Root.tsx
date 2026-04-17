import React from "react";
import { Composition, staticFile } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { CaptionVideo } from "./CaptionVideo";
import { CAPTIONS } from "./data/captions";

// mediabunny でブラウザ側から動画メタデータ取得
async function getVideoInfo(videoUrl: string) {
  const { Input, BlobSource, ALL_FORMATS } = await import("mediabunny");

  const response = await fetch(videoUrl);
  const blob = await response.blob();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });

  const [videoTrack, duration] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.computeDuration(),
  ]);

  if (!videoTrack) throw new Error("動画トラックが見つかりません");

  const stats = await videoTrack.computePacketStats(120);
  const fps = Math.round(stats.averagePacketRate);
  const width = videoTrack.displayWidth;
  const height = videoTrack.displayHeight;

  input.dispose();
  return { fps, width, height, duration };
}

const calculateMetadata: CalculateMetadataFunction<Record<string, unknown>> =
  async () => {
    const videoUrl = staticFile("video.mp4");
    const { fps, width, height, duration } = await getVideoInfo(videoUrl);

    const lastCaption = CAPTIONS[CAPTIONS.length - 1];
    const durationInFrames = Math.ceil(
      Math.min(duration, lastCaption.endMs / 1000 + 0.05) * fps
    );

    return { fps, width, height, durationInFrames };
  };

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CaptionVideo"
      component={CaptionVideo}
      durationInFrames={1056}
      fps={30}
      width={1072}
      height={1920}
      calculateMetadata={calculateMetadata}
    />
  );
};
