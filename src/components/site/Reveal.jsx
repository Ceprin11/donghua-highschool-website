import React, { useEffect, useRef } from "react";

export default function Reveal({ children, className = "", id = undefined, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { element.classList.add("is-visible"); observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section {...props} ref={ref} id={id} className={`reveal-section ${className}`}>{children}</section>;
}
