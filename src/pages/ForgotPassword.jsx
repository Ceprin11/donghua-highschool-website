import React from "react";
import SectionHeading from "@/components/site/SectionHeading";

export default function DataAndCameraNotice() {
  return (
    <div className="mx-auto max-w-[800px] px-5 md:px-8 py-10">
      <SectionHeading eyebrow="使用说明" title="数据与摄像头使用说明" />
      <div className="space-y-5 text-base text-foreground/80 leading-relaxed">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-2">数据使用</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>课堂小测的答题与判分仅在本机进行，不会上传到服务器，不采集学生身份与成绩。</li>
            <li>实验过程中的训练数据、采样结果和操作记录不写入数据库。</li>
            <li>后端只保存已发布的课程内容、实验配置与素材，不记录访客行为。</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-2">摄像头使用</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>摄像头手势实验不会自动开启摄像头，需要您主动点击"开启摄像头"并授权。</li>
            <li>本实验不申请麦克风权限，不上传、录制或保存任何视频帧和手部轨迹。</li>
            <li>所有手部关键点检测与交互判定均在您的浏览器本地完成。</li>
            <li>退出实验、关闭摄像头或切换页面后，摄像头流与推理任务会立即停止。</li>
            <li>若拒绝授权或设备无摄像头，可使用鼠标/触屏替代操作（不计为摄像头功能完成）。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}