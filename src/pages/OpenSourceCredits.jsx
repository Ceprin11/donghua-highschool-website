import React from "react";
import { ArrowUpRight } from "lucide-react";
import PageHeader from "@/components/site/PageHeader";
import Reveal from "@/components/site/Reveal";

const CREDITS = [
  { name: "TensorFlow Playground", url: "https://github.com/tensorflow/playground", note: "神经网络训练实验参考其交互设计与教学思路。" },
  { name: "CNN Explainer", url: "https://github.com/poloclub/cnn-explainer", note: "CNN 探索移植 Polo Club 的网络可视化、模型与逐层运算，采用 MIT 许可证。" },
  { name: "TensorSpace", url: "https://github.com/tensorspace-team/tensorspace", note: "LeNet 手写推理和训练可视化基于其开源示例，采用 Apache-2.0 许可证。" },
  { name: "Transformer Explainer", url: "https://github.com/poloclub/transformer-explainer", note: "语言模型实验移植 Polo Club 的 GPT-2 可视化，采用 MIT 许可证。" },
  { name: "Teachable Machine Community", url: "https://github.com/googlecreativelab/teachablemachine-community", note: "姿势识别复用 Apache-2.0 开源 Pose 训练代码，使用 PoseNet 检测关键点并训练姿势分类器。" },
  { name: "REINFORCEjs", url: "https://github.com/karpathy/reinforcejs", note: "机器人奖励迷宫实验参考其强化学习实现思路。" },
];
export default function OpenSourceCredits() {
  return <div className="inner-page information-page"><PageHeader label="开源致谢" title="开源致谢" /><div className="page-width page-content">{CREDITS.map(item => <Reveal key={item.name} className="credit-row"><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-button">{item.name}<ArrowUpRight size={18} /></a><p>{item.note}</p></Reveal>)}<p className="credits-note">本项目遵循所使用资源的许可证要求。</p></div></div>;
}
