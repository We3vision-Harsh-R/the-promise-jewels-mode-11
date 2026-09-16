import { useLayoutEffect } from "react";
import { gsap } from "@/lib/gsap.js";

/**
 * Runs `callback` inside a gsap.context() scoped to `scopeRef`, and
 * reverts (cleans up) all tweens/ScrollTriggers created inside it when
 * the component unmounts. Use this in every animated section instead
 * of writing useLayoutEffect + gsap.context by hand each time.
 */
export default function useGSAP(callback, scopeRef, deps = []) {
  useLayoutEffect(() => {
    const ctx = gsap.context(callback, scopeRef);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
