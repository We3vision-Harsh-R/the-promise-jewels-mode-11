import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Staggered fade+rise reveal for a container's direct children.
// Usage: const ref = useGsapReveal([deps]); <div ref={ref}>...</div>
export function useGsapReveal(deps = [], options = {}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const targets = options.selector
      ? ref.current.querySelectorAll(options.selector)
      : ref.current.children

    if (!targets || targets.length === 0) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: options.y ?? 14 },
        {
          opacity: 1,
          y: 0,
          duration: options.duration ?? 0.5,
          stagger: options.stagger ?? 0.06,
          ease: options.ease ?? 'power3.out',
          delay: options.delay ?? 0,
        }
      )
    }, ref)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
