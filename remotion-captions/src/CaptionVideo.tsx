import React from "react";
import { Video, staticFile } from "remotion";
import { SubtitleLayer } from "./components/Subtitle";
import { CAPTIONS } from "./data/captions";

export const CaptionVideo: React.FC = () => {
  return (
    <>
      <Video src={staticFile("video.mp4")} />
      <SubtitleLayer captions={CAPTIONS} fps={30} />
    </>
  );
};
