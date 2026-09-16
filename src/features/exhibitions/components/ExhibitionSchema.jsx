import { useEffect } from "react";
import { DEFAULT_CONTACT, DEFAULT_SOCIAL_LINKS } from "@/features/settings/hooks/usePublicSettings.js";
import { getRange } from "@/features/exhibitions/data/exhibitions.js";

const SCRIPT_ID = "exhibition-jsonld";

/**
 * Injects JSON-LD structured data for the exhibition page.
 *
 * This is the highest-leverage SEO item on a page like this: Google renders
 * `Event` markup as a rich result (date, venue and status shown directly in
 * search), and `FAQPage` can surface the answers inline. Neither is visible
 * on the page, so nothing here changes the design.
 *
 * One <script> holds a @graph of every entity rather than several tags, and
 * it is removed on unmount so a client-side route change doesn't leave a
 * previous page's markup behind in <head>.
 */
export default function ExhibitionSchema({ exhibitions, faqs, siteUrl }) {
  useEffect(() => {
    const origin =
      siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const pageUrl = `${origin}/Exhibition`;

    const events = exhibitions.map((exhibition) => {
      const { start, end } = getRange(exhibition);

      return {
        "@type": "ExhibitionEvent",
        "@id": `${pageUrl}#${exhibition.id}`,
        name: `${exhibition.name} ${exhibition.year}`,
        description: exhibition.about,
        startDate: exhibition.venues[0].start,
        endDate: exhibition.venues[exhibition.venues.length - 1].end,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        // A show with two halls gets both, so the markup matches the page.
        location: exhibition.venues.map((venue) => ({
          "@type": "Place",
          name: venue.name,
          address: {
            "@type": "PostalAddress",
            addressLocality: exhibition.city,
            addressRegion: exhibition.region,
            addressCountry: "IN",
          },
        })),
        organizer: {
          "@type": "Organization",
          name: exhibition.organiser,
        },
        // Promise Jewels is an exhibitor, not the organiser — saying so
        // keeps the markup honest and still associates the brand with it.
        performer: {
          "@type": "Organization",
          name: "Promise Jewels Pvt. Ltd.",
        },
        image: `${origin}${exhibition.logo}`,
        isAccessibleForFree: false,
        // Kept so the value is obviously derived, not hand-typed.
        additionalProperty: {
          "@type": "PropertyValue",
          name: "Duration (days)",
          value: Math.round((end - start) / 86400000) + 1,
        },
      };
    });

    const graph = [
      {
        "@type": "Organization",
        "@id": `${origin}#organization`,
        name: "Promise Jewels Pvt. Ltd.",
        url: origin,
        description:
          "Gold and diamond jewellery manufacturer and wholesaler based in Surat, Gujarat.",
        // sameAs is where search engines pick up official social profiles.
        // Read from the shared settings fallbacks so there is one source.
        sameAs: [
          DEFAULT_SOCIAL_LINKS.instagram,
          DEFAULT_SOCIAL_LINKS.facebook,
          DEFAULT_SOCIAL_LINKS.linkedin,
        ],
        email: DEFAULT_CONTACT.email,
        telephone: DEFAULT_CONTACT.phone,
        address: {
          "@type": "PostalAddress",
          streetAddress: DEFAULT_CONTACT.address,
          addressLocality: "Surat",
          addressRegion: "Gujarat",
          postalCode: "395004",
          addressCountry: "IN",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Exhibitions", item: pageUrl },
        ],
      },
      ...events,
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ];

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = SCRIPT_ID;
    script.text = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });

    document.head.querySelector(`#${SCRIPT_ID}`)?.remove();
    document.head.appendChild(script);

    return () => document.getElementById(SCRIPT_ID)?.remove();
  }, [exhibitions, faqs, siteUrl]);

  return null;
}
