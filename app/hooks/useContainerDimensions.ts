import { RefObject, useLayoutEffect, useState } from "react";
import useResizeObserver from "@react-hook/resize-observer";

/**
 * Returns layout (untransformed) dimensions for a container.
 * Important: we intentionally avoid getBoundingClientRect/contentRect here because those
 * can include/exclude CSS transforms depending on browser and timing.
 */
export function useContainerDimensions<T extends HTMLElement | null>(ref: RefObject<T>) {
  const [size, setSize] = useState<DOMRect>();

  const read = () => {
    const el = ref.current;
    if (!el) return;
    // Layout box (does NOT include transforms)
    setSize(new DOMRect(0, 0, el.clientWidth, el.clientHeight));
  };

  useLayoutEffect(() => {
    read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useResizeObserver(ref, () => read());
  return size;
}
