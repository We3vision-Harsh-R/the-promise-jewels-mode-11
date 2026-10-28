import { logger } from "../../utils/logger.js";
import pageContentRepository from "./page-content.repository.js";
import { onPublicCacheCleared } from "../../middleware/publicCache.middleware.js";
import { getLayout } from "./page-layout.service.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  BRAND_PALETTE,
  CONTENT_PAGES,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LETTER_SPACING_MIN,
  LETTER_SPACING_MAX,
  PAGE_CONTENT_MESSAGES,
  defaultsFor,
  findPage,
  type ContentPage,
} from "./page-content.constants.js";


/**
 * Checks a styling value against the list it must come from.
 *
 * Every one of these ends up inside an inline `style` attribute on the public
 * site — a font family is a CSS fragment, not a caption. React escapes what it
 * puts in a style object, so this is not a script-injection hole, but an
 * unchecked value still reaches every visitor's stylesheet and the admin form
 * is not the only thing that can POST here. The rule for this codebase is that
 * the server validates regardless of what the form allows, so these are
 * checked against the same lists the picker is built from.
 *
 * Returns null when the value is fine, or the reason it is not.
 */
function styleValueProblem(
  type: string,
  value: string,
  field?: { options?: { value: string }[] },
): string | null {
  // Empty always means "no override, use the design's own styling", and the
  // caller deletes the row rather than storing it.
  if (value === "") return null;

  if (type === "font") {
    return FONT_FAMILIES.some((f) => f.value === value)
      ? null
      : "not one of the site's fonts";
  }

  if (type === "weight") {
    return FONT_WEIGHTS.some((w) => w.value === value)
      ? null
      : "not one of the available weights";
  }

  if (type === "fontsize") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "must be a number";
    return n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX
      ? null
      : `must be between ${FONT_SIZE_MIN} and ${FONT_SIZE_MAX} pixels`;
  }

  if (type === "spacing") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "must be a number";
    return n >= LETTER_SPACING_MIN && n <= LETTER_SPACING_MAX
      ? null
      : `must be between ${LETTER_SPACING_MIN} and ${LETTER_SPACING_MAX} em`;
  }

  if (type === "choice") {
    return field?.options?.some((option) => option.value === value)
      ? null
      : "not one of the offered choices";
  }

  if (type === "toggle") {
    return value === "true" || value === "false" ? null : "must be on or off";
  }

  if (type === "frames") {
    return /^\d{1,2}(,\d{1,2}){0,29}$/.test(value) ? null : "must be photo numbers separated by commas";
  }

  if (type === "teamvis") {
    return /^[A-Za-z0-9-]{1,64}(,[A-Za-z0-9-]{1,64}){0,199}$/.test(value) ? null : "is not a valid list of people";
  }

  if (type === "brandteams") {
    try {
      const parsed = JSON.parse(value);
      const ok =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.values(parsed).every((ids) => typeof ids === "string" && /^[A-Za-z0-9,-]{0,600}$/.test(ids));
      return ok ? null : "is not a valid list of people";
    } catch {
      return "is not a valid list of people";
    }
  }

  if (type === "number") {
    return Number.isFinite(Number(value)) ? null : "must be a number";
  }

  if (type === "color") {
    // #rgb, #rrggbb or #rrggbbaa — the picker writes the last form when the
    // opacity slider is moved off 100%.
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
      ? null
      : "must be a hex colour like #0B5B5D";
  }

  return null;
}

/** `{ section: { field: value } }` — the shape both the admin and site read. */
type ContentValues = Record<string, Record<string, string>>;

function assertPage(key: string): ContentPage {
  const page = findPage(key);

  if (!page) {
    throw new ApiError(404, PAGE_CONTENT_MESSAGES.PAGE_NOT_FOUND);
  }

  return page;
}

/** An Editor page, as last read, until something is saved. */
const adminPageCache = new Map<string, { data: unknown; expiresAt: number }>();
const ADMIN_PAGE_TTL_MS = 10 * 60_000;

/** Pages the Editor has asked for, so they can be read again in the background after a save. */
const requestedPages = new Set<string>();
let rewarmTimer: NodeJS.Timeout | null = null;

onPublicCacheCleared(() => {
  adminPageCache.clear();

  // Someone is editing: a few seconds after the last save, read the pages they
  // had open again, one after another, so the next tab they click is ready too.
  if (rewarmTimer) clearTimeout(rewarmTimer);
  rewarmTimer = setTimeout(() => {
    rewarmTimer = null;
    void warmAdminPages([...requestedPages]);
  }, 4_000);
  rewarmTimer.unref();
});

class PageContentService {
  /**
   * The page list for the Editor's tab bar — no values, just labels.
   *
   * Standalone areas (the header and the footer) are left out: they have their
   * own screens under Editor, and a tab for them here would be a second place
   * to edit the same thing.
   */
  listPages() {
    return CONTENT_PAGES.filter((page) => !page.standalone).map((page) => ({
      key: page.key,
      label: page.label,
      path: page.path,
      sectionCount: page.sections.length,
      arrangeable: page.arrangeable === true,
    }));
  }

  /**
   * Saved values merged over the declared defaults, so every field the schema
   * declares always comes back with something to render. Rows for fields the
   * schema no longer declares are ignored rather than returned — removing an
   * editable string from the code should not leak stale copy to the site.
   */
  private async valuesFor(page: ContentPage): Promise<ContentValues> {
    const values = defaultsFor(page);
    const rows = await pageContentRepository.listByPage(page.key);

    for (const row of rows) {
      if (values[row.section] && row.field in values[row.section]) {
        values[row.section][row.field] = row.value;
      }
    }

    return values;
  }

  /** What the public website reads: values only, no labels or field types. */
  async getPublic(pageKey: string) {
    const page = assertPage(pageKey);

    return this.valuesFor(page);
  }

  /**
   * What the Editor renders: the field declarations AND the current values.
   * One request, because the form needs both and they must describe the same
   * schema version.
   */
  async getAdmin(pageKey: string) {
    const page = assertPage(pageKey);
    requestedPages.add(page.key);

    // The same answer for everyone until something is saved, so it is kept in
    // memory and emptied the moment any save goes through (see publicCache).
    // Opening a tab again — or someone else opening it — costs no database trip.
    const cached = adminPageCache.get(page.key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // The values and the arrangement are independent, so they are fetched
    // together: one trip to the database instead of two in a row.
    const [values, layout] = await Promise.all([this.valuesFor(page), getLayout(page.key)]);

    const data = {
      key: page.key,
      label: page.label,
      path: page.path,
      sections: page.sections,
      // Whether this page can be rearranged from the panel. The Editor
      // shows its Arrangement card only when it can.
      arrangeable: page.arrangeable === true,
      // The brand colours travel with the schema so every colour picker in the
      // Editor offers the same list — one file to change, whole Editor follows.
      palette: BRAND_PALETTE,
      // The typefaces and weights travel the same way, and for the same
      // reason the server checks them on the way back in: the Editor must
      // offer exactly the set that will be accepted, not a list maintained
      // separately in the frontend that can drift out of step with it.
      fonts: FONT_FAMILIES,
      weights: FONT_WEIGHTS,
      limits: {
        fontSize: { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX },
        spacing: { min: LETTER_SPACING_MIN, max: LETTER_SPACING_MAX },
      },
      values,
      // The saved arrangement travels with the schema rather than being
      // fetched separately: the Editor lists its section cards in this order,
      // so arriving a request later would show the cards in one order and
      // then shuffle them.
      layout,
    };

    adminPageCache.set(page.key, { data, expiresAt: Date.now() + ADMIN_PAGE_TTL_MS });
    return data;
  }

  /**
   * Saves one page. Only fields the schema declares are accepted — an unknown
   * section or field is a 404 rather than a silently ignored write, so a
   * typo in a client payload is visible instead of appearing to succeed.
   *
   * A value equal to its default is stored as a DELETE, not a row: the table
   * then holds only genuine overrides, and clearing a field back to the
   * shipped copy leaves no trace to clean up later.
   */
  async update(pageKey: string, input: ContentValues) {
    const page = assertPage(pageKey);

    const toSave: { section: string; field: string; value: string }[] = [];
    const toDelete: { section: string; field: string }[] = [];

    for (const [sectionKey, fields] of Object.entries(input)) {
      const section = page.sections.find((item) => item.key === sectionKey);

      if (!section) {
        throw new ApiError(404, PAGE_CONTENT_MESSAGES.SECTION_NOT_FOUND);
      }

      for (const [fieldKey, rawValue] of Object.entries(fields)) {
        const field = section.fields.find((item) => item.key === fieldKey);

        if (!field) {
          throw new ApiError(404, PAGE_CONTENT_MESSAGES.FIELD_NOT_FOUND);
        }

        const value = rawValue.trim();

        const problem = styleValueProblem(field.type, value, field);

        if (problem) {
          throw new ApiError(
            400,
            `${section.label} — ${field.label}: ${problem}`,
          );
        }

        if (value.length > field.max) {
          throw new ApiError(
            400,
            `${section.label} — ${field.label}: ${PAGE_CONTENT_MESSAGES.TOO_LONG}`,
          );
        }

        // Emptying a field means "put the shipped copy back", not "render a
        // blank heading" — the same handling a value typed back to its
        // default gets. Either way the override row goes away.
        if (value === "" || value === field.default) {
          toDelete.push({ section: sectionKey, field: fieldKey });
        } else {
          toSave.push({ section: sectionKey, field: fieldKey, value });
        }
      }
    }

    await pageContentRepository.deleteMany(page.key, toDelete);
    await pageContentRepository.saveMany(page.key, toSave);

    return this.getAdmin(page.key);
  }
}

const service = new PageContentService();

/**
 * Reads Editor pages into memory one at a time, so the first click on a tab is
 * answered from memory too. Runs in the background after the server starts and
 * after saves; the database connection pool is small, so never in parallel.
 */
export async function warmAdminPages(keys: string[] = CONTENT_PAGES.map((page) => page.key)): Promise<void> {
  for (const key of keys) {
    try {
      await service.getAdmin(key);
    } catch (error) {
      logger.warn(`[page-content] warming "${key}" failed: ${(error as Error).message}`);
    }
  }
}

export default service;
