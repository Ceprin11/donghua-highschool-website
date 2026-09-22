import React from "react";
import SectionHeading from "@/components/site/SectionHeading";

export default function OpenSourceCredits() {
  const credits = [
    { name: "TensorFlow Playground", url: "https://github.com/tensorflow/playground", note: "神经网络训练场实验参考其交互设计与教学思路。" },
    { name: "MediaPipe Hand Landmarker", url: "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js", note: "摄像头手势实验使用其浏览器端手部关键点检测模型。" },
    { name: "REINFORCEjs", url: "https://github.com/karpathy/reinforcejs", note: "机器人奖励迷宫实验参考其强化学习实现思路。" },
    { name: "OpenCV.js 图像滤波", url: "https://docs.opencv.org/4.x/dd/d6a/tutorial_js_filtering.html", note: "像素与图像实验室参考其图像处理方法（本项目使用 Canvas 原生实现）。" },
  ];
  return (
    <div className="mx-auto max-w-[800px] px-5 md:px-8 py-10">
      <SectionHeading eyebrow="致谢" title="开源致谢" />
      <div className="space-y-4">
        {credits.map((c) => (
          <div key={c.name} className="rounded-xl border border-border bg-card p-5">
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-primary hover:underline">{c.name}</a>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-xs text-muted-foreground">本项目优先复用开源资源，遵循各自许可证要求。</div>
    </div>
  );
}