import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar.jsx";
import SmoothScroll from "@/components/common/SmoothScroll.jsx";
import CustomCursor from "@/components/common/CustomCursor.jsx";
import PageTransition from "@/components/common/PageTransition.jsx";
import { scrollToTop, settleToSection } from "@/utils/scroll.js";
import { prefetchPages } from "@/app/routes/lazyPages.js";
import { pingVisit } from "@/features/visitors/tracker.js";
import { ScrollTrigger } from "@/lib/gsap.js";

/**
 * Rendered next to the page, inside the same Suspense boundary, so it mounts
 * only once the page's code has arrived. Pages are loaded on demand, and the
 * page's pins are created as it mounts — measuring them again a moment later,
 * when the layout has settled, is what keeps their start and end positions true.
 */
function RemeasureWhenPageMounts() {
  useEffect(() => {
    const first = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    const second = window.setTimeout(() => ScrollTrigger.refresh(), 900);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  return null;
}

export default function ClientLayout() {
  const { pathname, hash } = useLocation();

  // Section links that live on another page — "Our Team" in the navbar and
  // footer points at the leaders section of /AboutPage — navigate with a
  // hash. React Router does not scroll for a hash on its own, and the target
  // does not exist until the new page has rendered.
  useEffect(() => {
    if (!hash) {
      scrollToTop();
      return undefined;
    }

    return settleToSection(hash.slice(1));
  }, [pathname, hash]);

  // Tells the server this visitor is here — on arrival, on every page change,
  // and every thirty seconds while the tab is in view. Only a country and a page
  // are kept; see features/visitors/tracker.js.
  useEffect(() => {
    pingVisit(pathname);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") pingVisit(pathname);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [pathname]);

  // Once the first page has loaded, fetch the others while the browser is idle
  // so every link after this one opens instantly.
  useEffect(() => {
    if (document.readyState === "complete") {
      prefetchPages();
      return undefined;
    }

    window.addEventListener("load", prefetchPages, { once: true });
    return () => window.removeEventListener("load", prefetchPages);
  }, []);

  return (
    <div className="web-theme">
      {/* Both are render-null and self-disable on touch / reduced-motion, so
          they cost nothing on devices that should not have them. */}
      <SmoothScroll />
      <CustomCursor />
      <Navbar />
      {/* Keyed on the path so each route mounts a fresh wrapper and replays
          the entrance, instead of the router swapping content in silently. */}
      <PageTransition key={pathname}>
        <Suspense fallback={null}>
          <Outlet />
          <RemeasureWhenPageMounts />
        </Suspense>
      </PageTransition>
    </div>
  );
}
