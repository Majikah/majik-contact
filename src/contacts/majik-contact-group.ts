/* -------------------------------
 * Photo Parsing Utility
 * ------------------------------- */

import {
  SYSTEM_GROUP_IDS,
  SYSTEM_GROUP_NAMES,
  SystemGroupId,
} from "../constants";
import { MajikContactGroupError } from "../errors";
import {
  MajikContactGroupData,
  MajikContactGroupMeta,
  MajikContactGroupSetOptions,
  SerializedMajikContactGroup,
} from "../types";
import { isSystemGroupId, normalizePhotoToBase64 } from "../utils";

/* -------------------------------
 * MajikContactGroup Class
 * ------------------------------- */

export class MajikContactGroup {
  public readonly id: string;
  public readonly isSystem: boolean;

  public meta: MajikContactGroupMeta;

  private memberIds: Set<string>;

  constructor(data: MajikContactGroupData) {
    this.assertId(data.id);

    this.id = data.id;
    this.isSystem = data.isSystem ?? false;

    this.meta = {
      name: data.meta?.name ?? "",
      description: data.meta?.description ?? "",
      photoBase64: data.meta?.photoBase64 ?? null,
      createdAt: data.meta?.createdAt ?? new Date().toISOString(),
      updatedAt: data.meta?.updatedAt ?? new Date().toISOString(),
    };

    // System groups always get their locked names — user-supplied names are ignored
    if (this.isSystem && isSystemGroupId(this.id)) {
      this.meta.name = SYSTEM_GROUP_NAMES[this.id as SystemGroupId];
    } else if (!this.isSystem) {
      // Non-system groups must have a name
      this.assertName(this.meta.name);
    }

    const rawIds = data.memberIds ?? [];
    this.assertMemberIds(rawIds);
    this.memberIds = new Set(rawIds);
  }

  /* ================================
   * Static Factories
   * ================================ */

  static create(
    id: string,
    name: string,
    meta?: Partial<Omit<MajikContactGroupMeta, "name">>,
    memberIds?: string[],
  ): MajikContactGroup {
    return new MajikContactGroup({
      id,
      meta: { name, ...meta },
      memberIds,
      isSystem: false,
    });
  }

  /**
   * Create the system "Favorites" group.
   * Should only be called once per MajikContactGroupManager instance.
   */
  static createFavorites(): MajikContactGroup {
    return new MajikContactGroup({
      id: SYSTEM_GROUP_IDS.FAVORITES,
      isSystem: true,
    });
  }

  /**
   * Create the system "Blocked" group.
   * Should only be called once per MajikContactGroupManager instance.
   */
  static createBlocked(): MajikContactGroup {
    return new MajikContactGroup({
      id: SYSTEM_GROUP_IDS.BLOCKED,
      isSystem: true,
    });
  }

  /* ================================
   * Metadata Mutation
   * ================================ */

  updateName(name: string): this {
    if (this.isSystem) {
      throw new MajikContactGroupError(
        `System group "${this.meta.name}" cannot be renamed`,
      );
    }
    this.assertName(name);
    this.meta.name = name.trim();
    this.updateTimestamp();
    return this;
  }

  updateDescription(description: string): this {
    if (typeof description !== "string") {
      throw new MajikContactGroupError("Description must be a string");
    }
    this.meta.description = description.trim();
    this.updateTimestamp();
    return this;
  }

  /**
   * Accepts any photo format (base64, data-URL, HTTP URL, Blob, ArrayBuffer, Uint8Array).
   * Always normalizes and stores as a base64 data-URL string.
   */
  async setPhoto(input: unknown): Promise<this> {
    if (input === null || input === undefined) {
      throw new MajikContactGroupError(
        "Photo input must not be null or undefined. Call clearPhoto() to remove.",
      );
    }
    try {
      this.meta.photoBase64 = await normalizePhotoToBase64(input);
      this.updateTimestamp();
      return this;
    } catch (err) {
      if (err instanceof MajikContactGroupError) throw err;
      throw new MajikContactGroupError("Failed to set photo", err);
    }
  }

  clearPhoto(): this {
    this.meta.photoBase64 = null;
    this.updateTimestamp();
    return this;
  }

  hasPhoto(): boolean {
    return this.meta.photoBase64 !== null && this.meta.photoBase64.length > 0;
  }

  /* ================================
   * Membership Management
   * ================================ */

  addMember(contactId: string): this {
    this.assertContactId(contactId);
    if (this.memberIds.has(contactId)) {
      throw new MajikContactGroupError(
        `Contact "${contactId}" is already a member of group "${this.meta.name}"`,
      );
    }
    this.memberIds.add(contactId);
    this.updateTimestamp();
    return this;
  }

  /**
   * Idempotent — safe to call even if the contact is already a member.
   */
  addMemberIfAbsent(contactId: string): this {
    this.assertContactId(contactId);
    if (!this.memberIds.has(contactId)) {
      this.memberIds.add(contactId);
      this.updateTimestamp();
    }
    return this;
  }

  addMembers(contactIds: string[]): this {
    this.assertMemberIds(contactIds);
    const duplicates = contactIds.filter((id) => this.memberIds.has(id));
    if (duplicates.length > 0) {
      throw new MajikContactGroupError(
        `The following contacts are already members: ${duplicates.join(", ")}`,
      );
    }
    contactIds.forEach((id) => this.memberIds.add(id));
    this.updateTimestamp();
    return this;
  }

  removeMember(contactId: string): this {
    this.assertContactId(contactId);
    if (!this.memberIds.has(contactId)) {
      throw new MajikContactGroupError(
        `Contact "${contactId}" is not a member of group "${this.meta.name}"`,
      );
    }
    this.memberIds.delete(contactId);
    this.updateTimestamp();
    return this;
  }

  /**
   * Idempotent — safe to call even if the contact is not a member.
   */
  removeMemberIfPresent(contactId: string): this {
    this.assertContactId(contactId);
    if (this.memberIds.has(contactId)) {
      this.memberIds.delete(contactId);
      this.updateTimestamp();
    }
    return this;
  }

  hasMember(contactId: string): boolean {
    this.assertContactId(contactId);
    return this.memberIds.has(contactId);
  }

  listMemberIds(): string[] {
    return [...this.memberIds];
  }

  memberCount(): number {
    return this.memberIds.size;
  }

  isEmpty(): boolean {
    return this.memberIds.size === 0;
  }

  clearMembers(): this {
    this.memberIds.clear();
    this.updateTimestamp();
    return this;
  }

  /* ================================
   * System Group Helpers
   * ================================ */

  isFavorites(): boolean {
    return this.id === SYSTEM_GROUP_IDS.FAVORITES;
  }

  isBlocked(): boolean {
    return this.id === SYSTEM_GROUP_IDS.BLOCKED;
  }

  /* ================================
   * Set Operations — Static
   * ================================ */

  /**
   * Merges two or more groups into a single new group.
   *
   * - Member IDs are unioned across all groups; duplicates are silently discarded.
   * - The resulting group ID defaults to the first group's ID unless `options.overrideId` is set.
   * - The resulting group name defaults to the first group's name unless `options.overrideName` is set.
   * - The resulting group is never a system group, regardless of the input groups.
   * - Meta (description, photo) is taken from the first group.
   *
   * @param groups   Two or more MajikContactGroup instances to merge.
   * @param options  Optional overrides for the resulting group's ID and name.
   */
  static merge(
    groups: MajikContactGroup[],
    options?: MajikContactGroupSetOptions,
  ): MajikContactGroup {
    MajikContactGroup.assertGroupArray(groups, "merge");

    const source = groups[0];
    const resultId = options?.id?.trim() || source.id;
    const resultName = options?.name?.trim() || source.meta.name;

    if (options?.id !== undefined) {
      MajikContactGroup.assertStaticId(options.id, "overrideId");
    }
    if (options?.name !== undefined) {
      MajikContactGroup.assertStaticName(options.name, "overrideName");
    }

    // Union all member ID sets — Set discards duplicates automatically
    const unionedIds = new Set<string>();
    for (const group of groups) {
      for (const id of group.memberIds) {
        unionedIds.add(id);
      }
    }

    return new MajikContactGroup({
      id: resultId,
      isSystem: false,
      meta: {
        name: resultName,
        description: source.meta.description,
        photoBase64: source.meta.photoBase64 ?? undefined,
      },
      memberIds: [...unionedIds],
    });
  }

  /**
   * Returns a new group containing only the member IDs present in ALL provided groups (intersection).
   *
   * - The resulting group ID defaults to the first group's ID unless `options.overrideId` is set.
   * - The resulting group name defaults to the first group's name unless `options.overrideName` is set.
   * - The resulting group is never a system group, regardless of the input groups.
   * - Meta (description, photo) is taken from the first group.
   * - Returns a group with zero members if there is no common membership.
   *
   * @param groups   Two or more MajikContactGroup instances to intersect.
   * @param options  Optional overrides for the resulting group's ID and name.
   */
  static intersect(
    groups: MajikContactGroup[],
    options?: MajikContactGroupSetOptions,
  ): MajikContactGroup {
    MajikContactGroup.assertGroupArray(groups, "intersect");

    const source = groups[0];
    const resultId = options?.id?.trim() || source.id;
    const resultName = options?.name?.trim() || source.meta.name;

    if (options?.id !== undefined) {
      MajikContactGroup.assertStaticId(options.id, "overrideId");
    }
    if (options?.name !== undefined) {
      MajikContactGroup.assertStaticName(options.name, "overrideName");
    }

    // Start from the first group's members, then narrow down group by group
    let intersection = new Set<string>(source.memberIds);
    for (let i = 1; i < groups.length; i++) {
      const currentIds = groups[i].memberIds;
      for (const id of intersection) {
        if (!currentIds.has(id)) {
          intersection.delete(id);
        }
      }
    }

    return new MajikContactGroup({
      id: resultId,
      isSystem: false,
      meta: {
        name: resultName,
        description: source.meta.description,
        photoBase64: source.meta.photoBase64 ?? undefined,
      },
      memberIds: [...intersection],
    });
  }

  /* ================================
   * Set Operations — Instance
   * ================================ */

  /**
   * Merges one or more other groups into the current instance.
   * Member IDs from all provided groups are unioned into `this`; duplicates are silently discarded.
   * Mutates `this` in place and returns `this` for chaining.
   *
   * @param others  One or more groups whose members should be merged into this group.
   */
  mergeWith(...others: MajikContactGroup[]): this {
    if (!others || others.length === 0) {
      throw new MajikContactGroupError(
        "mergeWith requires at least one other group",
      );
    }
    for (let i = 0; i < others.length; i++) {
      if (!(others[i] instanceof MajikContactGroup)) {
        throw new MajikContactGroupError(
          `Argument at index ${i} is not a MajikContactGroup instance`,
        );
      }
      for (const id of others[i].memberIds) {
        this.memberIds.add(id); // Set silently ignores duplicates
      }
    }
    this.updateTimestamp();
    return this;
  }

  /**
   * Narrows this group's membership to only the contact IDs also present in ALL of the provided groups.
   * Mutates `this` in place and returns `this` for chaining.
   *
   * @param others  One or more groups to intersect with.
   */
  intersectWith(...others: MajikContactGroup[]): this {
    if (!others || others.length === 0) {
      throw new MajikContactGroupError(
        "intersectWith requires at least one other group",
      );
    }
    for (let i = 0; i < others.length; i++) {
      if (!(others[i] instanceof MajikContactGroup)) {
        throw new MajikContactGroupError(
          `Argument at index ${i} is not a MajikContactGroup instance`,
        );
      }
      const otherIds = others[i].memberIds;
      for (const id of this.memberIds) {
        if (!otherIds.has(id)) {
          this.memberIds.delete(id);
        }
      }
    }
    this.updateTimestamp();
    return this;
  }

  /* ================================
   * Serialization
   * ================================ */

  toJSON(): SerializedMajikContactGroup {
    return {
      id: this.id,
      meta: { ...this.meta },
      memberIds: this.listMemberIds(),
      isSystem: this.isSystem,
    };
  }

  static fromJSON(serialized: SerializedMajikContactGroup): MajikContactGroup {
    if (!serialized || typeof serialized !== "object") {
      throw new MajikContactGroupError("Invalid serialized group data");
    }
    try {
      return new MajikContactGroup({
        id: serialized.id,
        meta: serialized.meta,
        memberIds: serialized.memberIds,
        isSystem: serialized.isSystem,
      });
    } catch (err) {
      if (err instanceof MajikContactGroupError) throw err;
      throw new MajikContactGroupError(
        "Failed to deserialize MajikContactGroup",
        err,
      );
    }
  }

  /* ================================
   * Assertions / Validation
   * ================================ */

  private updateTimestamp(): void {
    this.meta.updatedAt = new Date().toISOString();
  }

  private assertId(id: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError("Group ID must be a non-empty string");
    }
  }

  private assertName(name: string): void {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new MajikContactGroupError("Group name must be a non-empty string");
    }
    if (name.trim().length > 64) {
      throw new MajikContactGroupError(
        "Group name must not exceed 64 characters",
      );
    }
    // Prevent users from creating groups with system-reserved names
    const reserved = Object.values(SYSTEM_GROUP_NAMES).map((n) =>
      n.toLowerCase(),
    );
    if (reserved.includes(name.trim().toLowerCase())) {
      throw new MajikContactGroupError(
        `"${name.trim()}" is a reserved system group name and cannot be used`,
      );
    }
  }

  private assertContactId(id: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError("Contact ID must be a non-empty string");
    }
  }

  private assertMemberIds(ids: string[]): void {
    if (!Array.isArray(ids)) {
      throw new MajikContactGroupError("Member IDs must be an array");
    }
    ids.forEach((id, index) => {
      if (!id || typeof id !== "string" || id.trim().length === 0) {
        throw new MajikContactGroupError(
          `Invalid member ID at index ${index}: must be a non-empty string`,
        );
      }
    });
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new MajikContactGroupError(
        "Member IDs must not contain duplicates",
      );
    }
  }

  /**
   * Validates the groups array supplied to static set operations.
   * Requires at least two valid MajikContactGroup instances.
   */
  private static assertGroupArray(
    groups: unknown,
    operationName: string,
  ): asserts groups is [
    MajikContactGroup,
    MajikContactGroup,
    ...MajikContactGroup[],
  ] {
    if (!Array.isArray(groups)) {
      throw new MajikContactGroupError(
        `${operationName}: expected an array of MajikContactGroup instances`,
      );
    }
    if (groups.length < 2) {
      throw new MajikContactGroupError(
        `${operationName}: requires at least two groups, but received ${groups.length}`,
      );
    }
    groups.forEach((g, index) => {
      if (!(g instanceof MajikContactGroup)) {
        throw new MajikContactGroupError(
          `${operationName}: item at index ${index} is not a MajikContactGroup instance`,
        );
      }
    });
  }

  private static assertStaticId(id: string, fieldName: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError(
        `${fieldName} must be a non-empty string`,
      );
    }
  }

  private static assertStaticName(name: string, fieldName: string): void {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new MajikContactGroupError(
        `${fieldName} must be a non-empty string`,
      );
    }
    if (name.trim().length > 64) {
      throw new MajikContactGroupError(
        `${fieldName} must not exceed 64 characters`,
      );
    }
    const reserved = Object.values(SYSTEM_GROUP_NAMES).map((n) =>
      n.toLowerCase(),
    );
    if (reserved.includes(name.trim().toLowerCase())) {
      throw new MajikContactGroupError(
        `${fieldName}: "${name.trim()}" is a reserved system group name and cannot be used`,
      );
    }
  }
}
