import React, { useId } from "react";

// Editorial diagrams illustrate each experiment without starting its engine or camera.
export default function ExperimentArt({ engine = "neural" }) {
  const patternId = useId();
  const layers = [2, 5, 4, 1];
  const pos = (layer, node) => [72 + layer * 118, 170 + (node - (layers[layer] - 1) / 2) * 48];
  return <div className={`experiment-art art-${engine}`} aria-hidden="true">
    <svg viewBox="0 0 500 340" fill="none">
      {engine === "neural" && <>
        {layers.slice(0, -1).flatMap((n, l) => Array.from({ length: n }, (_, i) => Array.from({ length: layers[l + 1] }, (_, j) => <path key={`${l}-${i}-${j}`} d={`M${pos(l, i).join(" ")}L${pos(l + 1, j).join(" ")}`} stroke={(i + j) % 3 ? "#dba351" : "#82afc9"} strokeOpacity=".48" />)))}
        {layers.flatMap((n, l) => Array.from({ length: n }, (_, i) => <g key={`${l}-${i}`}><circle cx={pos(l, i)[0]} cy={pos(l, i)[1]} r="15" fill="#fff" stroke={l === 3 ? "#e99a19" : "#9bb4c4"} strokeWidth="1.4" /><circle className="art-node" style={{ animationDelay: `${l * 0.3 + i * 0.1}s` }} cx={pos(l, i)[0]} cy={pos(l, i)[1]} r="6" fill={l === 3 ? "#ffac27" : "#c4dce9"} /></g>))}
        <text x="72" y="310" textAnchor="middle">数据</text><text x="250" y="310" textAnchor="middle">寻找规律</text><text x="426" y="310" textAnchor="middle">预测</text>
      </>}
      {engine === "cv" && <>
        {Array.from({ length: 100 }, (_, i) => { const x = i % 10, y = Math.floor(i / 10); const inside = (x - 4.5) ** 2 + (y - 4.5) ** 2 < 17; return <rect key={i} x={112 + x * 28} y={26 + y * 28} width="25" height="25" rx="2" fill={inside ? ["#ff9d00", "#f4b54f", "#ffd88e"][i % 3] : "#e6e9e8"} />; })}
        <rect className="art-scan" x="109" y="22" width="284" height="31" rx="2" stroke="#24292c" strokeWidth="1.5" /><text x="250" y="326" textAnchor="middle">像素网格</text>
      </>}
      {engine === "transformer" && <>
        <text x="54" y="63" className="art-sentence">今天的天气</text><path d="M368 41V70" stroke="#ee980c" strokeWidth="3" />
        {[["晴朗", 280], ["阴沉", 208], ["寒冷", 139], ["温暖", 77]].map(([word, length], i) => <g key={word}><text x="54" y={120 + i * 48}>{word}</text><rect className="art-probability" style={{ animationDelay: `${i * 0.12}s` }} x="108" y={102 + i * 48} width={length} height="24" rx="3" fill={["#ffab22", "#ffc267", "#f5d49f", "#e7e3dc"][i]} /></g>)}
        <text x="250" y="321" textAnchor="middle">候选词概率</text>
      </>}
      {engine === "maze" && <>
        <defs><pattern id={patternId} width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" stroke="#d5dbd9" /></pattern></defs><rect x="118" y="30" width="264" height="264" fill={`url(#${patternId})`} />
        {[[162,74],[206,74],[294,118],[162,206],[250,206]].map(([x,y]) => <rect key={`${x}-${y}`} x={x} y={y} width="44" height="44" rx="2" fill="#d2d8d5" />)}
        <path className="art-route" d="M140 52V184H272V272H360" stroke="#ff9d00" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><circle cx="140" cy="52" r="11" fill="#262b2b" /><circle cx="360" cy="272" r="13" fill="#ff9d00" /><text x="250" y="326" textAnchor="middle">迷宫路径</text>
      </>}

    </svg>
  </div>;
}
