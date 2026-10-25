/** Where a person is shown on the About page. */
export const TEAM_KINDS = ["leader", "team"] as const;

/** Which company a person belongs to. */
export const TEAM_CATEGORIES = ["promise-jewels", "netram"] as const;

export const TEAM_MESSAGES = {
  FETCHED: "Team fetched successfully.",
  CREATED: "Team member added.",
  UPDATED: "Team member updated.",
  DELETED: "Team member removed.",
  STATUS_UPDATED: "Team member visibility updated.",
  REORDERED: "Team order saved.",
  NOT_FOUND: "Team member not found.",
} as const;
