import { useMemo, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading.jsx";
import usePublicSettings from "@/features/settings/hooks/usePublicSettings.js";
import usePublicCollections from "@/features/collections/hooks/usePublicCollections.js";
import { createInquiry } from "@/features/inquiries/inquiry.api.js";
import { classNames } from "@/utils/helpers.js";

// Fallback for the "Selected Collection" dropdown. The live options are the
// real collections from Admin > Collections — an enquiry naming a collection
// that does not exist is not much use to whoever reads it. These generic
// categories stand in while that request is in flight, if it fails, or while
// no collection has been added yet.
const DEFAULT_COLLECTIONS = [
  "Necklaces",
  "Rings",
  "Earrings",
  "Pendants",
  "Bangles",
  "Bracelets",
  "Bridal Sets",
  "Chains",
];

// Left-panel photo (teal "Business Inquiry" card).
const PANEL_IMAGE = "/images/collection/image_366.png";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalisePhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

const emptyForm = (defaultCollection) => ({
  name: "",
  email: "",
  company: "",
  phone: "",
  collection: defaultCollection,
  message: "",
});

/* ---- Inline icons (kept local; the whole codebase inlines its SVGs) ---- */
function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.9" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
// Small field-icons — sit inside the input's left padding (see IconInput).
function UserFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}
function MailFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
function CompanyFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function PhoneFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function GemFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M9 3l3 6-3 12M15 3l-3 6 3 12" />
    </svg>
  );
}
function PencilFieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

/* Colour hierarchy for this form, highest priority first:
     1. #01383B  deep teal  — what the user types, and the submit action
     2. #0B5B5D  mid teal   — field labels
     3. #7E9694  muted      — placeholders, icons, "optional" hints
     4. #C9A15A  gold       — required markers and the focus state
     5. #B23A2E  clay red   — errors only, never decoration
   Nothing outside this list is used, so importance is legible at a glance. */
const labelCls =
  "mb-[9px] flex items-baseline gap-[5px] text-[0.7rem] font-semibold tracking-[0.14em] uppercase text-[#0B5B5D] font-ticker";
const inputBase =
  "w-full rounded-[16px] border-[1px] bg-white px-[16px] py-[13px] text-[0.95rem] text-[#01383B] font-ticker " +
  "placeholder:text-[#9FB3B1] focus:outline-none";

// Small labelled field wrapper — local to this form, styled for the white
// card (teal labels), not the admin ink/brass Field primitive.
function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? (
          <span className="text-[#C9A15A]">*</span>
        ) : (
          // Saying which fields are optional is more useful than marking the
          // required ones twice, and keeps the gold reserved for one meaning.
          <span className="font-normal normal-case tracking-normal text-[0.68rem] max-[479px]:text-[0.7rem] text-[#7E9694]">
            (optional)
          </span>
        )}
      </span>
      {children}
      {error && <span className="mt-[6px] block text-[0.72rem] text-[#B23A2E]">{error}</span>}
    </label>
  );
}

// Wraps an input/select/textarea with a small leading icon inside the
// field's left padding, matching the Figma reference (every field in the
// form has a small teal-grey icon before the text). `iconTop` lets the
// textarea variant pin the icon to the top instead of vertically centering.
function IconInput({ icon, iconTop, children }) {
  return (
    <div className="relative">
      <span
        className={classNames(
          "pointer-events-none absolute left-[14px] text-[#7E9694]",
          iconTop ? "top-[15px]" : "top-1/2 -translate-y-1/2"
        )}
      >
        {icon}
      </span>
      {children}
    </div>
  );
}

/**
 * "Let's Discuss Your Jewelry Requirements" — a teal contact panel beside a
 * business-inquiry form. Reused on both the collection page (as a section)
 * and the contact page (as the main content).
 *
 * Submission is client-side only for now: fields are validated, the payload
 * is logged, and a success state replaces the form. Wire to a createInquiry
 * service later without touching this component's markup.
 *
 * The "Selected Collection" dropdown lists the live collections; pass
 * `collections` to override it (e.g. only one brand's lines).
 *
 * Usage:
 *   <InquiryForm id="inquiry" />
 *   <InquiryForm collections={["Rings","Earrings"]} defaultCollection="Rings" />
 */
export default function InquiryForm({
  id,
  collections: collectionsProp,
  defaultCollection,
}) {
  const { contact } = usePublicSettings();
  const { collections: liveCollections } = usePublicCollections();

  // An explicit prop wins; otherwise the live names, falling back to the
  // bundled categories until (or unless) those arrive.
  const collections = useMemo(() => {
    if (collectionsProp?.length) return collectionsProp;
    const names = liveCollections.map((c) => c.name).filter(Boolean);
    return names.length ? names : DEFAULT_COLLECTIONS;
  }, [collectionsProp, liveCollections]);

  // Seeded EMPTY unless a caller names a default. The live option list only
  // arrives after first render, so pre-selecting a bundled name would leave
  // the select holding a value that is not among its own options — which
  // renders blank. The field is optional anyway, so "none" is a real answer.
  // A lazy initial value, not an effect: the list arriving later must not
  // reset a choice the visitor has already made.
  const [form, setForm] = useState(() => emptyForm(defaultCollection ?? ''));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [focused, setFocused] = useState(null);

  // Focus/border colour is applied inline rather than through `focus:`
  // utilities. Bootstrap ships a `.border` class marked !important that
  // overrides Tailwind's border-colour utilities site-wide, which is why the
  // teal focus ring on this form never actually appeared. Inline styles are
  // not in that fight at all.
  const fieldProps = (key, hasError) => ({
    onFocus: () => setFocused(key),
    onBlur: () => setFocused(null),
    style: {
      borderColor:
        focused === key ? "#C9A15A" : hasError ? "#E0B4AC" : "#DCEAE7",
      boxShadow:
        focused === key
          ? "0 0 0 3px rgba(201, 161, 90, 0.20)"
          : hasError
          ? "0 0 0 3px rgba(178, 58, 46, 0.10)"
          : "none",
      transition: "border-color 0.35s ease, box-shadow 0.35s ease",
    },
  });

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSubmitError("");
    // Clear a field's error as soon as the user starts correcting it.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your full name.";
    if (!form.email.trim()) next.email = "Please enter your email address.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Please enter a valid email address.";
    if (!form.phone.trim()) next.phone = "Please enter your phone number.";
    else if (normalisePhone(form.phone).length !== 10) next.phone = "Please enter a valid 10-digit phone number.";
    if (!form.message.trim()) next.message = "Please tell us about your requirements.";
    else if (form.message.trim().length < 10) next.message = "Message must be at least 10 characters.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Client-side only — no backend/service call is wired yet (by design).
    setSubmitting(true);
    setSubmitError("");

    try {
      await createInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalisePhone(form.phone),
        company: form.company.trim(),
        // The current database has no collection column, so preserve it in
        // the saved message rather than losing this customer context. The
        // field is optional — when nothing was picked the message goes as
        // typed, rather than carrying a "Collection:" line with nothing on it.
        message: form.collection
          ? `Collection: ${form.collection}\n\n${form.message.trim()}`
          : form.message.trim(),
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error.message || "We couldn't send your inquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm(defaultCollection));
    setErrors({});
    setSubmitError("");
    setSubmitted(false);
  };

  return (
    <section
      id={id}
      className="w-full bg-white px-[8%] pt-[30px] pb-[90px] max-[991px]:pb-[70px] max-[479px]:px-[6%]"
    >
      <div className="text-center">
        <SectionHeading light="Let's Discuss Your" bold="Jewelry Requirements" className="text-center" />
      </div>

      <div
        className="
          mt-[45px] mx-auto w-full max-w-[1200px]
          grid grid-cols-[328px_minmax(0,1fr)] gap-[26px]
          max-[991px]:grid-cols-1 max-[991px]:gap-[20px]
        "
      >
        {/* Left: teal Business Inquiry panel — fixed 328px on desktop,
            full-width on mobile (see max-[991px]:grid-cols-1 above). */}
<div className="relative overflow-hidden rounded-[40px] w-full min-h-[420px] max-[991px]:min-h-[300px] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.28)] bg-black">

  <img
    src={PANEL_IMAGE}
    alt="Business inquiry"
    loading="lazy"
    className="absolute inset-0 h-full w-full object-cover object-center"
  />

  {/* Teal scrim rather than black — keeps the panel inside the palette */}
  <div className="absolute inset-0 bg-[#01383B]/20" />
  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#01383B]/25 to-[#01383B]/90" />

  {/* Gold hairline inset, matching the card system elsewhere */}
  <span className="pointer-events-none absolute inset-[16px] z-[2] rounded-[26px] border-[1px] border-[#C9A15A]/35 max-[479px]:inset-[11px] max-[479px]:rounded-[18px]" />

  <div className="relative z-[2] flex h-full flex-col justify-end p-[34px] text-white max-[479px]:p-[24px]">
            <span className="mb-[12px] block h-px w-[34px] bg-[#C9A15A]" />
            <h3 className="m-0 mb-[26px] font-ticker text-[1.9rem] font-semibold max-[479px]:text-[1.4rem] max-[479px]:mb-[14px]">
              Business Inquiry
            </h3>

            <ul className="m-0 flex list-none flex-col gap-[20px] p-0 max-[479px]:gap-[14px]">
              <li className="flex items-start gap-[14px]">
                <span className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#0B5B5D] border-[1px] border-[#C9A15A]/40 max-[479px]:h-[32px] max-[479px]:w-[32px]">
                  <PhoneIcon />
                </span>
                <span>
                  <span className="block text-[0.66rem] max-[479px]:text-[0.7rem] uppercase tracking-[0.24em] text-[#E8CB92]">Phone</span>
                  <span className="block text-[0.98rem] font-ticker max-[479px]:text-[0.85rem]">{contact.phone}</span>
                </span>
              </li>
              <li className="flex items-start gap-[14px]">
                <span className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#0B5B5D] border-[1px] border-[#C9A15A]/40 max-[479px]:h-[32px] max-[479px]:w-[32px]">
                  <MailIcon />
                </span>
                <span>
                  <span className="block text-[0.66rem] max-[479px]:text-[0.7rem] uppercase tracking-[0.24em] text-[#E8CB92]">Email</span>
                  <span className="block break-all text-[0.98rem] font-ticker max-[479px]:text-[0.8rem] max-[479px]:leading-[1.3]">{contact.email}</span>
                </span>
              </li>
              <li className="flex items-start gap-[14px]">
                <span className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#0B5B5D] border-[1px] border-[#C9A15A]/40 max-[479px]:h-[32px] max-[479px]:w-[32px]">
                  <LocationIcon />
                </span>
                <span>
                  <span className="block text-[0.66rem] max-[479px]:text-[0.7rem] uppercase tracking-[0.24em] text-[#E8CB92]">Location</span>
                  <span className="block text-[0.98rem] leading-[1.5] font-ticker max-[479px]:text-[0.8rem] max-[479px]:leading-[1.35]">{contact.address}</span>
                </span>
              </li>
              {contact.hours?.length ? (
                <li className="flex items-start gap-[14px]">
                  <span className="mt-[2px] flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#0B5B5D] border-[1px] border-[#C9A15A]/40 max-[479px]:h-[32px] max-[479px]:w-[32px]">
                    <ClockIcon />
                  </span>
                  <span>
                    <span className="block text-[0.66rem] max-[479px]:text-[0.7rem] uppercase tracking-[0.24em] text-[#E8CB92]">Business Hours</span>
                    {contact.hours.map((line) => (
                      <span key={line} className="block text-[0.98rem] leading-[1.5] font-ticker max-[479px]:text-[0.8rem] max-[479px]:leading-[1.35]">
                        {line}
                      </span>
                    ))}
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* Right: form card (or success state after submit) */}
        <div className="rounded-[32px] border-[1px] border-[#E4EFEC] bg-white p-[34px] shadow-[0_24px_60px_-32px_rgba(0,0,0,0.28)] max-[479px]:p-[22px]">
          {submitted ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center">
              <span className="mb-[20px] flex h-[74px] w-[74px] items-center justify-center rounded-full bg-gradient-to-b from-[#01383B] to-[#286F6F] text-white">
                <CheckIcon />
              </span>
              <h3 className="m-0 mb-[10px] font-ticker text-[1.6rem] font-semibold text-[#0B5B5D]">
                Thank you, {form.name.split(" ")[0] || "there"}!
              </h3>
              <p className="m-0 max-w-[420px] text-[1rem] leading-[1.6] text-[#7E9694] font-ticker">
                Your inquiry has been received. Our team will get back to you shortly at{" "}
                <strong className="text-[#0B5B5D]">{form.email}</strong>.
              </p>
              <button
                type="button"
                onClick={resetForm}
                className="mt-[28px] rounded-full border-[1px] border-[#0B5B5D] bg-transparent px-[30px] py-[13px] text-[0.95rem] font-semibold text-[#0B5B5D] transition-colors hover:bg-[#0B5B5D] hover:text-white"
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-2 gap-[18px] max-[639px]:grid-cols-1">
                <Field label="Full Name" required error={errors.name}>
                  <IconInput icon={<UserFieldIcon />}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Name"
                      {...fieldProps("name", Boolean(errors.name))}
                      className={classNames(inputBase, "pl-[40px]")}
                    />
                  </IconInput>
                </Field>

                <Field label="Email Address" required error={errors.email}>
                  <IconInput icon={<MailFieldIcon />}>
                    <input
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="Email Address"
                      {...fieldProps("email", Boolean(errors.email))}
                      className={classNames(inputBase, "pl-[40px]")}
                    />
                  </IconInput>
                </Field>

                <Field label="Company Name">
                  <IconInput icon={<CompanyFieldIcon />}>
                    <input
                      type="text"
                      value={form.company}
                      onChange={update("company")}
                      placeholder="Your Company"
                      {...fieldProps("company", false)}
                      className={classNames(inputBase, "pl-[40px]")}
                    />
                  </IconInput>
                </Field>

                <Field label="Phone Number" required error={errors.phone}>
                  <IconInput icon={<PhoneFieldIcon />}>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="Your Phone Number"
                      {...fieldProps("phone", Boolean(errors.phone))}
                      className={classNames(inputBase, "pl-[40px]")}
                    />
                  </IconInput>
                </Field>

                <div className="col-span-2 max-[639px]:col-span-1">
                  <Field label="Selected Collection">
                    <IconInput icon={<GemFieldIcon />}>
                      <div className="relative">
                        <select
                          value={form.collection}
                          onChange={update("collection")}
                          {...fieldProps("collection", false)}
                          className={classNames(inputBase, "appearance-none pl-[40px] pr-[42px] cursor-pointer")}
                        >
                          <option value="">No specific collection</option>
                          {collections.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-[16px] top-1/2 -translate-y-1/2 text-[#0B5B5D]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </div>
                    </IconInput>
                  </Field>
                </div>

                <div className="col-span-2 max-[639px]:col-span-1">
                  <Field label="Your Message" required error={errors.message}>
                    <IconInput icon={<PencilFieldIcon />} iconTop>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={update("message")}
                        placeholder="Tell us about your jewellery requirements, quantity, customization needs, and timeline."
                        {...fieldProps("message", Boolean(errors.message))}
                        className={classNames(inputBase, "pl-[40px]", "resize-y")}
                      />
                    </IconInput>
                  </Field>
                </div>
              </div>

              {submitError ? (
                <p className="mt-[18px] text-[0.82rem] text-[#B23A2E]" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="mt-[24px] inline-flex items-center gap-[12px] rounded-full border-0 bg-gradient-to-b from-[#01383B] to-[#286F6F] px-[34px] py-[15px] text-[0.98rem] font-semibold text-white cursor-pointer shadow-[0_14px_30px_-10px_rgba(1,56,59,0.55)] [transition:box-shadow_0.45s_ease,translate_0.45s_cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:shadow-[0_20px_38px_-10px_rgba(1,56,59,0.62)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Sending inquiry..." : "Send Business Inquiry"}
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-b from-[#E8B85C] to-[#C9922E] text-white">
                  <ArrowIcon />
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
