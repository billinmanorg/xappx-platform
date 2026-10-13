import xappy from "./assets/xappy.png";

export function XappyGuide({ text }: { text: string }): JSX.Element {
  return <aside className="xappy-guide" aria-label="Xappy guidance">
    <img src={xappy} width="1024" height="1536" alt="Xappy, your preview guide" />
    <div className="xappy-guide-copy">
      <p className="guide-label">Predefined Xappy guidance</p>
      <p>{text}</p>
    </div>
  </aside>;
}
