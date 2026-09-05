import type { ReactNode } from "react";

export default function TutorialSlide({ illustration, title, body, tip }: { illustration: ReactNode; title: string; body: string; tip?: string }) {
  return <article className="tutorial-slide"><div className="tutorial-slide__illustration">{illustration}</div><div className="tutorial-slide__content"><h2>{title}</h2><p>{body}</p>{tip && <div className="tutorial-tip"><b>Pro tip</b><span>{tip}</span></div>}</div></article>;
}
