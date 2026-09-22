import React from "react";
import PlaceholderImage from "./PlaceholderImage";
import { Image } from "@/components/ui/image";

export default function TeacherCard({ teacher, layout = "row" }) {
  if (!teacher || !teacher.name) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
        <div className="text-sm text-muted-foreground">主讲教师资料待补充</div>
      </div>
    );
  }
  const photo = teacher.photo_url || "";
  const isStack = layout === "stack";
  return (
    <div className={`flex ${isStack ? "flex-col" : "flex-col md:flex-row"} gap-6 md:gap-8 items-start`}>
      <div className={isStack ? "w-full max-w-[280px]" : "w-full md:w-[240px] shrink-0"}>
        {photo ? <Image src={photo} alt={teacher.name} className="w-full aspect-[3/4] rounded-xl bg-muted" fittingType="fill" /> : <PlaceholderImage label="教师照片" aspect="aspect-[3/4]" />}
      </div>
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-foreground">{teacher.name}</h3>
          <div className="text-sm text-muted-foreground mt-1">{teacher.organization}{teacher.title_or_identity ? ` · ${teacher.title_or_identity}` : ""}</div>
        </div>
        {teacher.project_role && <div className="text-sm text-primary font-medium">{teacher.project_role}</div>}
        {teacher.short_bio && <p className="text-base text-foreground/80 leading-relaxed">{teacher.short_bio}</p>}
      </div>
    </div>
  );
}