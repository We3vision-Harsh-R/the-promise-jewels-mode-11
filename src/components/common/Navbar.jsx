import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { settleToSection } from "@/utils/scroll.js";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";

// Every href here is checked against AppRoutes.jsx. "Our Team" previously
// used `id: "team"` alone, which scrolled to an element that existed on no
// page in the app — so the item did nothing, on every route. It now points
// at the real leaders section on /AboutPage.
const MENU = [
  { title: "Home", href: "/" },
  { title: "About", href: "/AboutPage" },
  { title: "Our Team", href: "/AboutPage", hash: "team" },
  { title: "Our Brand", href: "/our-brand" },
  { title: "Collections", href: "/our-collection" },
  { title: "Exhibition Highlights", href: "/Exhibition" },
  { title: "Blog", href: "/blog" },
  { title: "Contact Us", href: "/contact" },
];

// Bundled labels and shades — the fallback, and the keys this bar reads. The
// hrefs are NOT editable: they are routes, and a typo in one would produce a
// menu item that leads nowhere. Only the wording and the colours are content.
const BAR = {
  linkColor: "#F7F3EA",
  linkHoverColor: "#C9A15A",
  background: "#01383B",
  ...Object.fromEntries(MENU.map((item, i) => [`link${i + 1}`, item.title])),
};

export default function Navbar() {
  // Menu wording and colours from Admin > Editor > Header.
  const bar = useSectionContent("header", "bar", BAR);
  const menu = MENU.map((item, index) => ({
    ...item,
    title: bar[`link${index + 1}`] || item.title,
  }));

  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const navbarRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  // Menu open/close animation — re-runs (and auto-reverts the previous
  // run) any time `open` changes, via the deps array on useGSAP.
  useGSAP(
    () => {
      if (!open || !menuRef.current) return;

      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: -30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" }
      );

      gsap.fromTo(
        itemRefs.current,
        { opacity: 0, y: -15 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.08,
          delay: 0.15,
          ease: "power3.out",
        }
      );
    },
    menuRef,
    [open]
  );

  // Closes the menu on an outside click/tap. This is unrelated to the
  // GSAP animation above, so it stays as a plain effect rather than
  // going through useGSAP.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (open && navbarRef.current && !navbarRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  // Handles both cases: real pages (href) navigate via the router, and
  // same-page sections (id) scroll into view. Either way, closes the menu.
  const handleNavClick = (item) => {
    if (!item.href) return;

    // Already on the target page: scroll here, because navigating to a path
    // we are already on would not re-fire the layout's hash effect. Uses the
    // same settle helper so both routes behave identically.
    if (item.hash && location.pathname === item.href) {
      settleToSection(item.hash);
      setOpen(false);
      return;
    }

    navigate(item.hash ? `${item.href}#${item.hash}` : item.href);
    setOpen(false);
  };

  return (
    <header
      ref={navbarRef}
      className="fixed top-0 left-0 w-full flex justify-center items-start z-[99999] px-[16px] box-border [transform:translateZ(0)] will-change-transform [backface-visibility:hidden] max-[768px]:px-[12px]"
    >
      <div
        className="relative w-[183px] h-[46px] flex justify-center items-center cursor-pointer shrink-0 overflow-hidden [transform:translateZ(0)] [backface-visibility:hidden] max-[992px]:w-[150px] max-[992px]:h-auto max-[992px]:[aspect-ratio:183/46] max-[768px]:w-[135px] max-[768px]:h-auto max-[768px]:[aspect-ratio:183/46] max-[480px]:w-[125px] max-[480px]:h-auto max-[480px]:[aspect-ratio:183/46]"
        onClick={() => setOpen(!open)}
      >
        <svg
          className="absolute inset-0 w-full h-full block overflow-visible [transform:translateZ(0)] [backface-visibility:hidden]"
          viewBox="0 0 183 46"
          width="183"
          height="46"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="menuGradient"
              x1="91.265"
              y1="0"
              x2="91.265"
              y2="45.05"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#01383B" />
              <stop offset="1" stopColor="#286F6F" />
            </linearGradient>
          </defs>

          <path
            d="M182.53 0V0.15C178.87 1.23 175.59 3.21 172.96 5.84C169.11 9.68 166.65 14.9 166.39 20.7C166.4 20.71 166.4 20.71 166.39 20.72C166.45 21.32 166.47 21.92 166.47 22.53C166.47 22.89 166.46 23.24 166.44 23.59C166.45 23.6 166.44 23.6 166.44 23.61C166.17 29.4 163.71 34.62 159.87 38.46C155.8 42.53 150.17 45.05 143.95 45.05H38.11C25.76 45.04 15.74 35.11 15.61 22.79C15.6 22.77 15.6 22.75 15.61 22.73C15.6 22.66 15.6 22.6 15.6 22.53C15.6 22.23 15.61 21.93 15.62 21.63V21.57C15.55 11.62 9.01 3.2 0 0.31V0H182.53Z"
            fill="url(#menuGradient)"
          />
        </svg>

        <div className="relative z-[2] flex flex-col gap-[5px] max-[768px]:gap-[4px]">
          <span
            className={`w-[22px] h-[2px] bg-white rounded-full transition duration-[350ms] max-[992px]:w-[20px] max-[768px]:w-[18px] max-[480px]:w-[16px] ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`w-[22px] h-[2px] bg-white rounded-full transition duration-[350ms] max-[992px]:w-[20px] max-[768px]:w-[18px] max-[480px]:w-[16px] ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`w-[22px] h-[2px] bg-white rounded-full transition duration-[350ms] max-[992px]:w-[20px] max-[768px]:w-[18px] max-[480px]:w-[16px] ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </div>
      </div>

      {open && (
        <div
          ref={menuRef}
          className="absolute top-[60px] left-1/2 -translate-x-1/2 w-[min(400px,calc(100vw-32px))] max-[992px]:top-[58px] max-[992px]:w-[min(360px,calc(100vw-32px))] max-[768px]:top-[52px] max-[768px]:w-[calc(100vw-24px)] max-[480px]:top-[48px] max-[480px]:w-[calc(100vw-20px)]"
        >
          <div className="relative w-full bg-[rgba(8,82,84,0.94)] [backdrop-filter:blur(20px)] rounded-[28px] overflow-hidden py-[28px] shadow-[0_25px_60px_rgba(0,0,0,0.22),inset_0_1px_1px_rgba(255,255,255,0.12)] before:content-[''] before:absolute before:-top-[26px] before:left-1/2 before:-translate-x-1/2 before:w-[88px] before:h-[46px] before:bg-[#0B5B5D] before:[border-radius:50px_50px_0_0]">
            {menu.map((item, index) => (
              <button
                key={item.title}
                ref={(el) => {
                  if (el) itemRefs.current[index] = el;
                }}
                onClick={() => handleNavClick(item)}
                className="w-full h-[58px] flex justify-center items-center bg-transparent border-0 text-white text-[20px] font-normal cursor-pointer transition duration-[350ms] hover:bg-white/[0.07] hover:text-[#FFE6A7]"
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
