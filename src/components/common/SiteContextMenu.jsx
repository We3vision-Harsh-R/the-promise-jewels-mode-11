import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";

const WIDTH = 240;
const EDGE = 8;

// Right-click on the public site opens this small menu instead of the browser's:
// "Home" goes to the home page, "Contact us" shows the email from Settings and
// opens the visitor's mail app. Text fields and selected text keep the native
// menu so copy / paste still work, and touch devices are left alone.
export default function SiteContextMenu() {
  const navigate = useNavigate();
  const { contact } = usePublicSettings();
  const [point, setPoint] = useState(null);
  const ref = useRef(null);

  const close = useCallback(() => setPoint(null), []);

  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)").matches) return undefined;

    function onContext(event) {
      const target = event.target;
      if (target.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (String(window.getSelection?.() ?? "").trim()) return;

      event.preventDefault();
      const height = 120;
      setPoint({
        x: Math.min(event.clientX, window.innerWidth - WIDTH - EDGE),
        y: Math.min(event.clientY, window.innerHeight - height - EDGE),
      });
    }

    window.addEventListener("contextmenu", onContext);
    return () => window.removeEventListener("contextmenu", onContext);
  }, []);

  useEffect(() => {
    if (!point) return undefined;

    function onDown(event) {
      if (!ref.current?.contains(event.target)) close();
    }
    function onKey(event) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [point, close]);

  if (!point) return null;

  const email = contact?.email;
  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#1a1a1a] transition-colors hover:bg-black/5";

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: point.x, top: point.y, width: WIDTH }}
      className="fixed z-[100000] rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur"
    >
      <button
        type="button"
        role="menuitem"
        className={item}
        onClick={() => {
          close();
          navigate("/");
        }}
      >
        Home
      </button>

      {email && (
        <a role="menuitem" href={`mailto:${email}`} className={item} onClick={close}>
          <span className="min-w-0">
            <span className="block">Contact us</span>
            <span className="block truncate text-xs text-black/50">{email}</span>
          </span>
        </a>
      )}
    </div>
  );
}
