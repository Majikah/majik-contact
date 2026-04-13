/* -------------------------------
 * Constants
 * ------------------------------- */

/**
 * System-reserved group IDs.
 * These groups are always present and cannot be renamed or deleted.
 * Membership within them is still fully manageable.
 */
export const SYSTEM_GROUP_IDS = {
  FAVORITES: "system::favorites",
  BLOCKED: "system::blocked",
} as const;

export type SystemGroupId =
  (typeof SYSTEM_GROUP_IDS)[keyof typeof SYSTEM_GROUP_IDS];

  /** Human-readable locked names for system groups */
export const SYSTEM_GROUP_NAMES: Record<SystemGroupId, string> = {
  [SYSTEM_GROUP_IDS.FAVORITES]: "Favorites",
  [SYSTEM_GROUP_IDS.BLOCKED]: "Blocked",
};
