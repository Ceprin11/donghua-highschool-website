import * as React from "react";

/** @param {{src?: string, alt?: string, className?: string, fittingType?: string, [key: string]: any}} props */
export function Image({ src, alt = "", className = "", fittingType: _fittingType, ...props }) {
  return src ? <img src={src} alt={alt} loading="lazy" className={className} {...props} /> : null;
}
