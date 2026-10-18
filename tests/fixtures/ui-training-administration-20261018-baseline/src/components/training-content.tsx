import type { TrainingBlock } from "@/lib/training/types";

export function TrainingContent({ blocks, headingLevel = 3 }: { blocks: TrainingBlock[]; headingLevel?: 3 | 5 }) {
  const output: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.type === "bullet" || block.type === "numbered") {
      const start = i;
      while (i < blocks.length && blocks[i].type === block.type) i++;
      const items = blocks.slice(start, i).map((item, index) => <li key={index}>{item.text}</li>);
      output.push(block.type === "bullet" ? <ul className="training-list" key={start}>{items}</ul> : <ol className="training-list" key={start}>{items}</ol>);
      continue;
    }
    if (block.type === "heading") output.push(headingLevel === 3 ? <h3 key={i}>{block.text}</h3> : <h5 key={i}>{block.text}</h5>);
    else if (block.type === "emphasis") output.push(<p key={i}><strong>{block.text}</strong></p>);
    else if (block.type === "callout") output.push(<aside className="training-callout" key={i}>{block.text}</aside>);
    else output.push(<p key={i}>{block.text}</p>);
    i++;
  }
  return <>{output}</>;
}
