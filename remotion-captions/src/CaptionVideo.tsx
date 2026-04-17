import React from "react";
import { Audio, Video, staticFile } from "remotion";
import { SubtitleLayer } from "./components/Subtitle";
import { CAPTIONS } from "./data/captions";
import { BGM_FILE, BGM_VOLUME } from "./config";

export const CaptionVideo: React.FC = () => {
  return (
    <>
      <Video src={staticFile("video.mp4")} />
      <Audio src={staticFile(BGM_FILE)} volume={BGM_VOLUME} loop />
      <SubtitleLayer captions={CAPTIONS} fps={30} />
    </>
  );
};
