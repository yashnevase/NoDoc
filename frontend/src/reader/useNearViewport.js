import { useEffect, useState } from "react";

export function useNearViewport(targetRef, rootRef, rootMargin = "700px 0px") {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: rootRef?.current || null, rootMargin }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [rootMargin, rootRef, targetRef]);

  return near;
}
