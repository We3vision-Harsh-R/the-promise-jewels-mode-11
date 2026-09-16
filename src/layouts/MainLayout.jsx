import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/common/Navbar.jsx";
import SmoothScroll from "@/components/common/SmoothScroll.jsx";
import CustomCursor from "@/components/common/CustomCursor.jsx";
import PageTransition from "@/components/common/PageTransition.jsx";
import { scrollToTop, settleToSection } from "@/utils/scroll.js";

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
        <Outlet />
      </PageTransition>
    </div>
  );
}
