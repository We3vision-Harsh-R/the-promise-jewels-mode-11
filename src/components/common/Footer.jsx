import { gsap } from "@/lib/gsap.js";
import useGSAP from "@/hooks/useGSAP.js";
import useReveal from "@/hooks/useReveal.js";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { scrollToTop } from "@/utils/scroll.js";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import { SocialLinks } from "@/components/common/SocialIcons.jsx";
import useSectionContent from "@/features/page-content/hooks/usePageContent.js";

// const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
// const API_BASE = import.meta.env.VITE_API_URL ?? "https://promise-jewels-rjw4.onrender.com";

// Every path here is checked against AppRoutes.jsx. Three of these were
// broken once and rendered a blank page when clicked — keep them in sync
// with the routes, and with Navbar.jsx:
//   /about          -> the route is /AboutPage
//   /our-exhibition -> the route is /Exhibition
//   /our-team       -> no such route; it is the leaders section of /AboutPage
const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/AboutPage" },
  { label: "Our Team", to: "/AboutPage#team" },
  { label: "Our Brand", to: "/our-brand" },
  { label: "Our Collection", to: "/our-collection" },
  { label: "Our Exhibition", to: "/Exhibition" },
  { label: "Blog", to: "/blog" },
  { label: "Contact Us", to: "/contact" },
];

// What the footer ships with. Everything here is editable from
// Admin > Editor > Footer, and these values are the fallback for an empty
// database or a failed request — so the footer never renders blank.
const BAND = {
  tagline: "JEWELLERY MANUFACTURER & WHOLESALE",
  logo: "",
  textColor: "#0B5B5D",
};

const TICKER = {
  item1: "Promise",
  item2: "Jewels",
  item3: "",
  // Drawn as a CSS mask rather than an <img>. A mask takes its colour from the
  // element, which is the whole reason the separator must be an SVG: a PNG
  // would carry its own colours and ignore the setting below.
  icon: "/Icons/ticker-star.svg",
  iconColor: "#C9A15A",
  speed: "36",
  gap: "60",
};

const TICKER_WORD_CLASS =
  "font-ticker text-[18rem] mr-[60px] bg-clip-text text-transparent " +
  "[-webkit-text-fill-color:transparent] bg-gradient-to-b from-[#01383B] to-[#286F6F] " +
  "min-[768px]:max-[1024px]:text-[6rem] min-[768px]:max-[1024px]:mr-[40px] " +
  "max-[430px]:text-[2.8rem] max-[430px]:mr-[24px]";

function ArrowUpIcon(props) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path d="M12 19V5M12 5L6 11M12 5l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Footer() {
  // Logo, contact details and social URLs all come from /settings/public via
  // this hook, which also holds the hardcoded fallbacks used when that
  // request fails — so a settings outage never blanks out the footer.
  const { logoUrl, contact, social } = usePublicSettings();

  const band = useSectionContent("footer", "band", BAND);
  const ticker = useSectionContent("footer", "ticker", TICKER);

  // The words that travel across the footer, in the order entered. A blank
  // entry is dropped rather than rendered as a gap.
  const tickerWords = [ticker.item1, ticker.item2, ticker.item3].filter(Boolean);

  // Seconds for one full pass, straight from the Editor's slider. Guarded so a
  // cleared field cannot produce a zero-duration tween, which GSAP treats as
  // "instant" and would render as a frozen strip.
  const tickerSeconds = Math.max(5, Number(ticker.speed) || 36);

  const footerRef = useRef(null);
  const tickerRef = useRef(null);
  const tickerTween = useRef(null);

  // Everything above the ticker uses the site-wide reveal, so the footer
  // arrives the same way as every section above it.
  useReveal(footerRef);

  useGSAP(
    () => {
      // Infinite scrolling ticker — same GSAP pattern as Herocircle.jsx's
      // ticker, so the whole codebase uses one consistent approach for
      // repeating scroll animations instead of mixing in a raw CSS keyframe.
      if (tickerRef.current) {
        tickerTween.current = gsap.to(tickerRef.current, {
          xPercent: -50,
          duration: tickerSeconds,
          ease: "none",
          repeat: -1,
        });
      }

      // The rule draws across rather than fading — it reads as the footer
      // being ruled off, which a fade doesn't convey.
      gsap.from(".js-rule", {
        scaleX: 0,
        duration: 1.1,
        ease: "power2.inOut",
        scrollTrigger: { trigger: footerRef.current, start: "top 88%" },
      });

      // Slow turn on the dashed ring, so the back-to-top control has some
      // life without asking for attention.
      gsap.to(".js-top", {
        rotation: 360,
        duration: 28,
        ease: "none",
        repeat: -1,
        transformOrigin: "50% 50%",
      });
    },
    footerRef,
    // Re-run when the speed changes so an edit shows without a reload.
    [tickerSeconds]
  );

  // Ease the ticker down instead of stopping it dead — a marquee that halts
  // under the cursor reads as broken.
  const setTickerSpeed = (value) => {
    if (tickerTween.current) {
      gsap.to(tickerTween.current, {
        timeScale: value,
        duration: 0.6,
        ease: "power2.out",
      });
    }
  };

  return (
    <footer ref={footerRef} className="w-full bg-white pt-[64px] px-[1.7rem] pb-0 flex flex-col items-center text-center min-[768px]:max-[1024px]:pt-[48px] min-[768px]:max-[1024px]:px-[1.5rem] max-[430px]:pt-[40px] max-[430px]:px-[1.2rem]">
      {/* Logo */}
      <div data-reveal className="js-foot flex flex-col items-center gap-[4px]">
        <img
          src={band.logo || logoUrl}
          alt="Promise Jewels logo"
          width={210}
          height={210}
          className="min-[768px]:max-[1024px]:w-[150px] min-[768px]:max-[1024px]:h-[150px] max-[430px]:w-[110px] max-[430px]:h-[110px]"
        />
      </div>

      <p data-reveal className="js-foot mt-[18px] text-[1rem] font-semibold tracking-[0.2em] uppercase text-[#0B5B5D] min-[768px]:max-[1024px]:text-[0.8rem] min-[768px]:max-[1024px]:mt-[16px] max-[430px]:text-[0.69rem] max-[430px]:mt-[14px] max-[430px]:tracking-[0.15em]"
        style={{ color: band.textColor }}
      >
        {band.tagline}
      </p>

      {/* Social links */}
      <SocialLinks
        links={social}
        variant="outline"
        data-reveal className="js-foot gap-[25px] mt-[26px] min-[768px]:max-[1024px]:gap-[18px] min-[768px]:max-[1024px]:mt-[20px] max-[430px]:gap-[14px] max-[430px]:mt-[18px]"
        itemClassName="w-[38px] h-[38px] min-[768px]:max-[1024px]:w-[34px] min-[768px]:max-[1024px]:h-[34px] max-[430px]:w-[30px] max-[430px]:h-[30px]"
      />

      {/* Nav links */}
      {/* gap was 190px with flex-nowrap — seven links at that spacing run
          far wider than any viewport, which is what forced the row to
          overflow. Wrapping with an even gap keeps it centred at any width. */}
      <nav data-reveal className="js-foot flex flex-wrap justify-center gap-x-[46px] gap-y-[14px] mt-[46px] min-[768px]:max-[1024px]:gap-x-[30px] min-[768px]:max-[1024px]:mt-[36px] max-[430px]:gap-x-[26px] max-[430px]:gap-y-[12px] max-[430px]:mt-[28px]">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="whitespace-nowrap text-[1.3rem] text-[#1a1a1a] no-underline hover:text-[#0B5B5D] min-[768px]:max-[1024px]:text-[1rem] max-[430px]:text-[0.9rem] max-[430px]:flex-none"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="js-rule w-full max-w-[1800px] h-[2px] origin-left bg-[#080808] mt-[36px] max-[430px]:mt-[26px]" />

      {/* Back to top */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        data-reveal className="js-foot group relative mt-[26px] w-[75px] h-[75px] rounded-[100px] bg-transparent text-[#0B5B5D] flex items-center justify-center cursor-pointer [transition:translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[4px] min-[768px]:max-[1024px]:w-[60px] min-[768px]:max-[1024px]:h-[60px] min-[768px]:max-[1024px]:mt-[24px] max-[430px]:w-[50px] max-[430px]:h-[50px] max-[430px]:mt-[20px]"
      >
        {/* The dashed ring is its own element so it can turn without taking
            the arrow around with it. */}
        <span className="js-top pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-[#0B5B5D]" />
        <ArrowUpIcon className="w-8 h-8 text-[#0B6A72] [transition:translate_0.45s_cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-[2px]" />
      </button>

      {/* Contact info */}
<div data-reveal className="js-foot w-full max-w-[1800px] flex justify-between gap-[60px] mt-[26px] text-left min-[768px]:max-[1024px]:flex-col min-[768px]:max-[1024px]:gap-[20px] min-[768px]:max-[1024px]:mt-[20px] max-[430px]:flex-col max-[430px]:gap-[16px] max-[430px]:mt-[20px]">
  <div>
    <p className="mt-0 mb-[6px] flex items-center text-[1.2rem] leading-[1.5] text-[#1a1a1a] min-[768px]:max-[1024px]:text-[1rem] max-[430px]:text-[0.8rem] max-[430px]:leading-[1.4]">
      <img src="/Icons/hugeicons--telephone.svg" alt="" className="mr-[10px] w-[1em] h-[1em]" />
      {contact.phone}
    </p>
    <p className="mt-0 mb-[6px] flex items-center text-[1.2rem] leading-[1.5] text-[#1a1a1a] min-[768px]:max-[1024px]:text-[1rem] max-[430px]:text-[0.8rem] max-[430px]:leading-[1.4]">
      <img src="/Icons/ic--outline-email.svg" alt="" className="mr-[10px] w-[1em] h-[1em]" />
      {contact.email}
    </p>
  </div>
  <div className="w-[420px] text-left ml-auto min-[768px]:max-[1024px]:w-full min-[768px]:max-[1024px]:ml-0 max-[430px]:w-full max-[430px]:ml-0">
    <p className="mt-0 mb-[6px] flex items-center text-[1.2rem] leading-[1.5] text-[#1a1a1a] min-[768px]:max-[1024px]:text-[1rem] max-[430px]:text-[0.8rem] max-[430px]:leading-[1.4]">
      <img src="/Icons/boxicons--location.svg" alt="" className="mr-[10px] w-[1em] h-[1em] shrink-0" />
      {contact.address}
    </p>
  </div>
</div>
    

            {/* Scrolling ticker */}
<div onMouseEnter={() => setTickerSpeed(0.15)} onMouseLeave={() => setTickerSpeed(1)} className="w-[calc(100%+3.4rem)] -mx-[1.7rem] h-[230px] overflow-hidden whitespace-nowrap mt-[32px] flex items-start min-[768px]:max-[1024px]:w-[calc(100%+3rem)] min-[768px]:max-[1024px]:-mx-[1.5rem] min-[768px]:max-[1024px]:h-[100px] min-[768px]:max-[1024px]:mt-[24px] max-[430px]:w-[calc(100%+2.4rem)] max-[430px]:-mx-[1.2rem] max-[430px]:h-[50px] max-[430px]:mt-[20px]">
  <div ref={tickerRef} className="inline-flex w-max will-change-transform leading-none">
          {/* Two identical copies so the xPercent(-50) loop is seamless.
              Each copy repeats the wordmark twice, which is what fills the
              strip at this type size. */}
          {[...Array(2)].map((_, copy) => (
            <div className="flex items-center" key={copy} aria-hidden={copy === 1}>
              {[...tickerWords, ...tickerWords].map((word, index) => (
                <span key={`${copy}-${index}`} className="flex items-center">
                  <span
                    className={TICKER_WORD_CLASS}
                    style={{ marginRight: `${ticker.gap}px` }}
                  >
                    {word}
                  </span>
                  {/* The separator. mask-image paints the shape and the
                      background supplies the colour, so one uploaded SVG can
                      be any colour the Editor asks for. */}
                  <span
                    aria-hidden
                    className="inline-block shrink-0 h-[7rem] w-[7rem] min-[768px]:max-[1024px]:h-[3rem] min-[768px]:max-[1024px]:w-[3rem] max-[430px]:h-[1.6rem] max-[430px]:w-[1.6rem]"
                    style={{
                      marginRight: `${ticker.gap}px`,
                      backgroundColor: ticker.iconColor,
                      maskImage: `url("${ticker.icon}")`,
                      WebkitMaskImage: `url("${ticker.icon}")`,
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                      maskSize: "contain",
                      WebkitMaskSize: "contain",
                    }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
