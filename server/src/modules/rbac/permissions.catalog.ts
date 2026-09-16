/**
 * Every permission this panel has, in one list.
 *
 * This file is the ONLY place a permission is declared. The server checks
 * against it, and the browser is handed it at sign-in rather than keeping its
 * own copy — the two cannot drift because there is only one list. A screen
 * added to the panel without an entry here has no permission to grant, and a
 * permission removed here disappears from every role's form at the same
 * moment it stops being enforced.
 *
 * A permission is a RESOURCE plus an ACTION: `collections:edit`. Resources
 * are the things an admin works on, which for this panel is one per screen
 * plus the System group. Actions are deliberately few — four verbs cover
 * everything here, and a longer list would mean role forms nobody reads.
 *
 * The frontend must never hard-code one of these strings in a check. It asks
 * `can(resource, action)`; the strings live here.
 */

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

export type Action = (typeof ACTIONS)[number];

export interface ResourceDefinition {
  /** Stored in role_permissions.resource. Never rename without a migration. */
  key: string;
  label: string;
  /** Which admin screen this governs, so the panel can gate its own nav. */
  path?: string;
  /** The group it appears under in the role editor and the sidebar. */
  group: "Management" | "Editor" | "Marketing" | "System";
  description: string;
  /** Only the verbs that mean something here. */
  actions: Action[];
}

/**
 * `view` is load-bearing beyond the screen it names: without it the sidebar
 * entry is not rendered and the route refuses to mount, so it is the switch
 * that hides a whole area from a role rather than showing it disabled.
 */
export const RESOURCES: ResourceDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    group: "Management",
    description: "The overview counts and recent activity.",
    actions: ["view"],
  },
  {
    key: "collections",
    label: "Collections",
    path: "/admin/collections",
    group: "Management",
    description: "Jewellery collections and their images.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "brands",
    label: "Brands",
    path: "/admin/brands",
    group: "Management",
    description: "The brand portfolio shown on /our-brand.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "exhibitions",
    label: "Exhibitions",
    path: "/admin/exhibitions",
    group: "Management",
    description: "Trade shows, their galleries and dates.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "exhibitionOps",
    label: "Exhibition operations",
    path: "/admin/exhibitions",
    group: "Management",
    description:
      "Running a show: stall details, budget and costs, the buyers met at the stall, the crew roster, and the stock carried there and back. Held apart from Exhibitions because writing a show's website copy and seeing its margin are different levels of trust.",
    actions: ["view", "create", "edit", "delete"],
  },

  {
    key: "inquiries",
    label: "Inquiries",
    path: "/admin/inquiries",
    group: "Management",
    description: "Business enquiries submitted from the contact form.",
    actions: ["view", "edit", "delete"],
  },

  {
    key: "content",
    label: "Content",
    path: "/admin/editor",
    group: "Editor",
    description: "The editable text, images and typography on every page.",
    actions: ["view", "edit"],
  },
  {
    key: "header",
    label: "Header",
    path: "/admin/header",
    group: "Editor",
    description: "The menu shown at the top of every page.",
    actions: ["view", "edit"],
  },
  {
    key: "footer",
    label: "Footer",
    path: "/admin/footer",
    group: "Editor",
    description: "The footer shown at the bottom of every page.",
    actions: ["view", "edit"],
  },

  {
    key: "sections",
    label: "Section designer",
    // Reached from the Editor's Arrangement panel rather than the sidebar —
    // designing a section is something you do while looking at the page it
    // belongs to, not from a menu.
    group: "Editor",
    description:
      "Designing brand-new sections and placing them on any page. Held apart from Content because it changes what a page IS, not what it says.",
    actions: ["view", "create", "edit", "delete"],
  },

  {
    key: "notes",
    label: "Vault",
    path: "/admin/vault",
    group: "System",
    description:
      "Private notes and passwords. This permission decides whether an account HAS a vault — never whose vault it sees. Every entry is readable only by the account that wrote it, the Master role included.",
    actions: ["view", "create", "edit", "delete"],
  },

  {
    key: "media",
    label: "Media library",
    // No screen of its own — it is the upload behind every image field.
    // It is a resource rather than being folded into "content" because
    // Collections, Brands and Exhibitions all upload through it too, so a
    // role that may add a collection needs it without needing the Editor.
    group: "Editor",
    description: "Uploading and deleting the images used across the panel.",
    actions: ["view", "create", "delete"],
  },

  {
    key: "blog",
    label: "Blog",
    path: "/admin/blog",
    group: "Marketing",
    description: "Posts, drafts and comment moderation.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "seo",
    label: "SEO",
    path: "/admin/seo",
    group: "Marketing",
    description: "Per-page meta titles, descriptions and sharing images.",
    actions: ["view", "edit"],
  },

  {
    key: "settings",
    label: "Settings",
    path: "/admin/settings",
    group: "System",
    description: "Site settings, contact details and your own password.",
    actions: ["view", "edit"],
  },
  {
    key: "users",
    label: "User Creation",
    path: "/admin/users",
    group: "System",
    description:
      "Admin accounts: who may sign in, and which role each of them holds.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "roles",
    label: "Roles",
    path: "/admin/roles",
    group: "System",
    description:
      "The roles themselves and exactly what each one may see and change.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "/admin/notifications",
    group: "System",
    description: "Declarations addressed to a role you hold.",
    actions: ["view"],
  },
  {
    key: "declarations",
    label: "Declaration",
    path: "/admin/declarations",
    group: "System",
    description:
      "Announcements to the team, addressed to the roles you choose.",
    actions: ["view", "create", "edit", "delete"],
  },
];

/** `resource:action` — the form a permission is stored and checked in. */
export type PermissionKey = string;

export function permissionKey(resource: string, action: Action): PermissionKey {
  return `${resource}:${action}`;
}

const RESOURCE_BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));

/** Every valid permission string, used to reject anything not on the list. */
export const ALL_PERMISSIONS: PermissionKey[] = RESOURCES.flatMap((resource) =>
  resource.actions.map((action) => permissionKey(resource.key, action)),
);

const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS);

export function isValidPermission(value: string): boolean {
  return ALL_PERMISSIONS_SET.has(value);
}

export function findResource(key: string): ResourceDefinition | undefined {
  return RESOURCE_BY_KEY.get(key);
}

/**
 * The name of the role that always holds everything.
 *
 * It is a name rather than a flag on the user so there is exactly one way to
 * be privileged. `isSystem` on the row stops it being renamed or deleted, and
 * the permission check short-circuits for it — so a resource added to the
 * catalogue is available to the master role immediately, without anyone
 * remembering to tick a new box.
 */
export const MASTER_ROLE_NAME = "Master";
