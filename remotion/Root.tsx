import { Composition } from "remotion";
import { JeetSurvivalPromo } from "./JeetSurvivalPromo";

// 25 seconds @ 30fps = 750 frames, 1080p.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="JeetSurvivalPromo"
      component={JeetSurvivalPromo}
      durationInFrames={750}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
