import React from "react";

export default function SectionHeading({ eyebrow = "", title, description = "", center = false }) {
  return (
    <div className={`mb-8 md:mb-10 ${center ? "text-center mx-auto max-w-2xl" : ""}`}>
      {eyebrow && <div className="text-xs font-semibold text-primary tracking-widest uppercase mb-2">{eyebrow}</div>}
      <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
      {description && <p className="mt-3 text-base text-muted-foreground leading-relaxed">{description}</p>}
    </div>
  );
}
