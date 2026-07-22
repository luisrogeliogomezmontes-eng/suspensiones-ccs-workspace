"use client";

import { useEffect, useRef, useState } from "react";

// Mide el ancho de un contenedor (para SVG responsivo con coords en píxeles).
export function useContainerWidth(initial = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
