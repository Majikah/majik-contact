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

/**
 * Represents a collection of contact identities.
 *
 * `MajikContactGroup` organizes contact IDs into named groups while supporting
 * metadata, photos, membership management, system-defined groups, set
 * operations, and JSON serialization.
 *
 * Groups can be either:
 *
 * - **Custom groups** — user-defined collections with editable names and
 *   metadata.
 * - **System groups** — reserved collections such as Favorites and Blocked
 *   whose names are controlled by the package.
 *
 * Membership is stored internally as a `Set`, ensuring each contact ID can
 * occur at most once.
 *
 * @remarks
 * Mutation methods generally return `this`, allowing fluent/chained usage:
 *
 * ```ts
 * group
 *   .updateDescription("Engineering contacts")
 *   .addMember(contactId)
 *   .setColor("#002968");
 * ```
 *
 * The class supports two styles of set operations:
 *
 * - Static `merge()` / `intersect()` methods create a **new group**.
 * - Instance `mergeWith()` / `intersectWith()` methods mutate the **current
 *   group**.
 *
 * Static and instance method surfaces are frozen after the class definition.
 *
 * @example
 * ```ts
 * const engineering = MajikContactGroup.create(
 *   "engineering",
 *   "Engineering",
 *   {
 *     description: "Engineering contacts",
 *   },
 * );
 *
 * engineering.addMember(contact.id);
 *
 * console.log(engineering.memberCount()); // 1
 * ```
 */
export class MajikContactGroup {
  /**
   * Application-level identifier for the group.
   *
   * Must be a non-empty string.
   */
  public readonly id: string;

  /**
   * Indicates whether this is a system-managed group.
   *
   * System groups use package-defined identifiers and names and have
   * restrictions on metadata such as renaming.
   */
  public readonly isSystem: boolean;

  /**
   * Mutable metadata associated with the group.
   *
   * Includes the group's name, description, photo, timestamps, and optional
   * color information.
   */
  public meta: MajikContactGroupMeta;

  /**
   * Internal membership store.
   *
   * A `Set` is used to guarantee unique contact IDs.
   *
   * @internal
   */
  private memberIds: Set<string>;

  /**
   * Creates a contact group from its serialized data structure.
   *
   * Default metadata values are applied automatically when fields are omitted.
   * System groups receive their reserved package-defined name regardless of
   * any user-supplied name.
   *
   * @param data - Group identity, metadata, membership, and system-group state.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the group ID, name, or member IDs are invalid.
   *
   * @example
   * ```ts
   * const group = new MajikContactGroup({
   *   id: "engineering",
   *   isSystem: false,
   *   meta: {
   *     name: "Engineering",
   *   },
   *   memberIds: [contact.id],
   * });
   * ```
   */
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
      color: data.meta?.color ?? undefined,
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

  /**
   * Creates a new custom contact group.
   *
   * The resulting group is explicitly marked as a non-system group.
   *
   * @param id - Unique application-level group identifier.
   * @param name - Human-readable group name.
   * @param meta - Optional metadata other than `name`.
   * @param memberIds - Optional initial contact IDs.
   *
   * @returns A newly created custom {@link MajikContactGroup}.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the ID, name, or member IDs are invalid.
   *
   * @example
   * ```ts
   * const team = MajikContactGroup.create(
   *   "engineering",
   *   "Engineering",
   *   {
   *     description: "Engineering team",
   *   },
   *   [alice.id, bob.id],
   * );
   * ```
   */
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
   * Creates the system **Favorites** group.
   *
   * The system-defined identifier and name are applied automatically.
   *
   * @returns A new Favorites system group.
   *
   * @remarks
   * This factory creates a group instance only. Higher-level managers should
   * ensure that only one Favorites group is maintained within a given
   * collection or contact manager.
   */
  static createFavorites(): MajikContactGroup {
    return new MajikContactGroup({
      id: SYSTEM_GROUP_IDS.FAVORITES,
      isSystem: true,
    });
  }

  /**
   * Creates the system **Blocked** group.
   *
   * The system-defined identifier and name are applied automatically.
   *
   * @returns A new Blocked system group.
   *
   * @remarks
   * This factory creates a group instance only. Higher-level managers should
   * ensure that only one Blocked group is maintained within a given
   * collection or contact manager.
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

  /**
   * Updates the group's name.
   *
   * System groups cannot be renamed.
   *
   * @param name - New non-empty group name. Names are trimmed before storage.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when:
   *
   * - The group is a system group.
   * - The name is empty or invalid.
   * - The name exceeds 64 characters.
   * - The name conflicts with a reserved system-group name.
   *
   * @example
   * ```ts
   * group.updateName("Engineering");
   * ```
   */
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

  /**
   * Updates the group's description.
   *
   * Leading and trailing whitespace is removed before storing the value.
   *
   * @param description - New group description.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when `description` is not a string.
   */
  updateDescription(description: string): this {
    if (typeof description !== "string") {
      throw new MajikContactGroupError("Description must be a string");
    }
    this.meta.description = description.trim();
    this.updateTimestamp();
    return this;
  }

  /**
   * Sets the group's color metadata.
   *
   * The provided value is trimmed before storage.
   *
   * @param color - Optional color string. Passing `undefined` clears the color.
   *
   * @returns The same group instance for method chaining.
   *
   * @example
   * ```ts
   * group.setColor("#002968");
   * ```
   */
  setColor(color?: string): this {
    this.meta.color = color?.trim();
    this.updateTimestamp();
    return this;
  }

  /**
   * Clears the group's color metadata.
   *
   * @returns The same group instance for method chaining.
   */
  clearColor(): this {
    this.setColor(undefined);
    this.updateTimestamp();
    return this;
  }

  /**
   * Sets the group's photo.
   *
   * The input is normalized into a Base64 data URL before being stored in
   * `meta.photoBase64`.
   *
   * Supported input forms depend on {@link normalizePhotoToBase64} and include:
   *
   * - Base64 strings
   * - Data URLs
   * - HTTP URLs
   * - `Blob`
   * - `ArrayBuffer`
   * - `Uint8Array`
   *
   * @param input - Photo source to normalize and store.
   *
   * @returns A promise resolving to the same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the input is `null` or `undefined`, or when photo normalization
   * fails.
   *
   * @example
   * ```ts
   * await group.setPhoto(file);
   * ```
   *
   * @remarks
   * Use {@link clearPhoto} to remove the current photo. Passing `null` or
   * `undefined` is intentionally rejected.
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

  /**
   * Removes the group's photo.
   *
   * @returns The same group instance for method chaining.
   *
   * @example
   * ```ts
   * group.clearPhoto();
   * ```
   */
  clearPhoto(): this {
    this.meta.photoBase64 = null;
    this.updateTimestamp();
    return this;
  }

  /**
   * Indicates whether the group currently has a photo.
   *
   * @returns `true` when a non-empty photo value is stored; otherwise `false`.
   */
  hasPhoto(): boolean {
    return this.meta.photoBase64 !== null && this.meta.photoBase64.length > 0;
  }

  /* ================================
   * Membership Management
   * ================================ */

  /**
   * Adds a contact to the group.
   *
   * This is a strict operation: attempting to add an existing member throws.
   *
   * @param contactId - Contact identifier to add.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the contact ID is invalid or is already a member.
   *
   * @example
   * ```ts
   * group.addMember(contact.id);
   * ```
   */
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
   * Adds a contact to the group only when it is not already a member.
   *
   * This operation is idempotent and is safe to call repeatedly.
   *
   * @param contactId - Contact identifier to add.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the contact ID is invalid.
   *
   * @example
   * ```ts
   * group.addMemberIfAbsent(contact.id);
   * group.addMemberIfAbsent(contact.id); // no error
   * ```
   */
  addMemberIfAbsent(contactId: string): this {
    this.assertContactId(contactId);
    if (!this.memberIds.has(contactId)) {
      this.memberIds.add(contactId);
      this.updateTimestamp();
    }
    return this;
  }

  /**
   * Adds multiple contacts to the group.
   *
   * This is a strict batch operation: if any supplied ID is already present,
   * the operation throws before adding the new IDs.
   *
   * @param contactIds - Contact identifiers to add.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when:
   *
   * - `contactIds` is not a valid array of unique IDs.
   * - Any supplied contact is already a member.
   *
   * @example
   * ```ts
   * group.addMembers([alice.id, bob.id]);
   * ```
   */
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

  /**
   * Removes a contact from the group.
   *
   * This is a strict operation: attempting to remove a non-member throws.
   *
   * @param contactId - Contact identifier to remove.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the contact ID is invalid or is not currently a member.
   *
   * @example
   * ```ts
   * group.removeMember(contact.id);
   * ```
   */
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
   * Removes a contact from the group when present.
   *
   * This operation is idempotent and is safe to call even when the contact is
   * already absent.
   *
   * @param contactId - Contact identifier to remove.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the contact ID is invalid.
   *
   * @example
   * ```ts
   * group.removeMemberIfPresent(contact.id);
   * group.removeMemberIfPresent(contact.id); // no error
   * ```
   */
  removeMemberIfPresent(contactId: string): this {
    this.assertContactId(contactId);
    if (this.memberIds.has(contactId)) {
      this.memberIds.delete(contactId);
      this.updateTimestamp();
    }
    return this;
  }

  /**
   * Checks whether a contact belongs to the group.
   *
   * @param contactId - Contact identifier to check.
   *
   * @returns `true` when the contact is a member; otherwise `false`.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the contact ID is invalid.
   */
  hasMember(contactId: string): boolean {
    this.assertContactId(contactId);
    return this.memberIds.has(contactId);
  }

  /**
   * Returns all contact IDs currently belonging to the group.
   *
   * A new array is returned, so modifying the result does not modify the
   * group's internal membership set.
   *
   * @returns An array containing the group's member IDs.
   *
   * @example
   * ```ts
   * const members = group.listMemberIds();
   * ```
   */
  listMemberIds(): string[] {
    return [...this.memberIds];
  }

  /**
   * Returns the number of contacts currently in the group.
   *
   * @returns The group's member count.
   */
  memberCount(): number {
    return this.memberIds.size;
  }

  /**
   * Indicates whether the group contains no members.
   *
   * @returns `true` when the group has zero members; otherwise `false`.
   */
  isEmpty(): boolean {
    return this.memberIds.size === 0;
  }

  /**
   * Removes all members from the group.
   *
   * @returns The same group instance for method chaining.
   *
   * @example
   * ```ts
   * group.clearMembers();
   * ```
   */
  clearMembers(): this {
    this.memberIds.clear();
    this.updateTimestamp();
    return this;
  }

  /* ================================
   * System Group Helpers
   * ================================ */

  /**
   * Indicates whether this group is the system Favorites group.
   *
   * @returns `true` when this group's ID matches the reserved Favorites group.
   */
  isFavorites(): boolean {
    return this.id === SYSTEM_GROUP_IDS.FAVORITES;
  }

  /**
   * Indicates whether this group is the system Blocked group.
   *
   * @returns `true` when this group's ID matches the reserved Blocked group.
   */
  isBlocked(): boolean {
    return this.id === SYSTEM_GROUP_IDS.BLOCKED;
  }

  /* ================================
   * Set Operations — Static
   * ================================ */

  /**
   * Creates a new group containing the union of all supplied groups.
   *
   * Every member ID from every source group is included. Duplicate member IDs
   * are silently collapsed.
   *
   * The resulting group's:
   *
   * - ID defaults to the first group's ID.
   * - Name defaults to the first group's name.
   * - Description and photo come from the first group.
   * - `isSystem` value is always `false`.
   *
   * `options.id` and `options.name` can be used to override the resulting
   * group's ID and name.
   *
   * @param groups - Two or more groups whose memberships should be unioned.
   * @param options - Optional ID and name overrides for the resulting group.
   *
   * @returns A new non-system group containing the unioned membership.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when fewer than two groups are supplied, a supplied value is not a
   * {@link MajikContactGroup}, or an override is invalid.
   *
   * @example
   * ```ts
   * const everyone = MajikContactGroup.merge(
   *   [engineering, design],
   *   {
   *     id: "all-staff",
   *     name: "All Staff",
   *   },
   * );
   * ```
   */
  static merge(
    groups: MajikContactGroup[],
    options?: MajikContactGroupSetOptions,
  ): MajikContactGroup {
    MajikContactGroup.assertGroupArray(groups, "merge");

    const source = groups[0];

    if (options?.id !== undefined) {
      MajikContactGroup.assertStaticId(options.id, "overrideId");
    }

    if (options?.name !== undefined) {
      MajikContactGroup.assertStaticName(options.name, "overrideName");
    }

    const resultId = options?.id !== undefined ? options.id.trim() : source.id;

    const resultName =
      options?.name !== undefined ? options.name.trim() : source.meta.name;
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
   * Creates a new group containing only members shared by every supplied group.
   *
   * This is a set intersection: a contact appears in the resulting group only
   * when its ID exists in all source groups.
   *
   * The resulting group's:
   *
   * - ID defaults to the first group's ID.
   * - Name defaults to the first group's name.
   * - Description and photo come from the first group.
   * - `isSystem` value is always `false`.
   *
   * `options.id` and `options.name` can be used to override the resulting
   * group's ID and name.
   *
   * When no contact is shared by all groups, the resulting group is empty.
   *
   * @param groups - Two or more groups whose memberships should be intersected.
   * @param options - Optional ID and name overrides for the resulting group.
   *
   * @returns A new non-system group containing only common members.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when fewer than two groups are supplied, a supplied value is not a
   * {@link MajikContactGroup}, or an override is invalid.
   *
   * @example
   * ```ts
   * const priority = MajikContactGroup.intersect(
   *   [engineering, favorites],
   *   {
   *     id: "priority-engineers",
   *     name: "Priority Engineers",
   *   },
   * );
   * ```
   */
  static intersect(
    groups: MajikContactGroup[],
    options?: MajikContactGroupSetOptions,
  ): MajikContactGroup {
    MajikContactGroup.assertGroupArray(groups, "intersect");

    const source = groups[0];

    if (options?.id !== undefined) {
      MajikContactGroup.assertStaticId(options.id, "overrideId");
    }

    if (options?.name !== undefined) {
      MajikContactGroup.assertStaticName(options.name, "overrideName");
    }

    const resultId = options?.id !== undefined ? options.id.trim() : source.id;

    const resultName =
      options?.name !== undefined ? options.name.trim() : source.meta.name;

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
   * Merges the membership of one or more groups into this group.
   *
   * This is an in-place union operation. Member IDs from every supplied group
   * are added to the current group, and duplicates are silently ignored.
   *
   * @param others - One or more groups whose members should be added to this
   * group.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when no groups are supplied or any argument is not a
   * {@link MajikContactGroup} instance.
   *
   * @example
   * ```ts
   * engineering.mergeWith(design, qa);
   * ```
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
   * Restricts this group's membership to contacts shared by every supplied
   * group.
   *
   * This is an in-place intersection operation. Any member not present in all
   * supplied groups is removed from the current group.
   *
   * @param others - One or more groups to intersect with this group.
   *
   * @returns The same group instance for method chaining.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when no groups are supplied or any argument is not a
   * {@link MajikContactGroup} instance.
   *
   * @example
   * ```ts
   * priority.intersectWith(favorites, engineering);
   * ```
   *
   * @remarks
   * Unlike {@link MajikContactGroup.intersect}, this method mutates the
   * existing group rather than creating a new group.
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

  /**
   * Serializes the group into its JSON-compatible representation.
   *
   * Membership is exposed as an array while all group metadata and the system
   * group flag are preserved.
   *
   * @returns A serialized {@link SerializedMajikContactGroup} object.
   *
   * @example
   * ```ts
   * const serialized = group.toJSON();
   * ```
   */
  toJSON(): SerializedMajikContactGroup {
    return {
      id: this.id,
      meta: { ...this.meta },
      memberIds: this.listMemberIds(),
      isSystem: this.isSystem,
    };
  }

  /**
   * Reconstructs a {@link MajikContactGroup} from serialized data.
   *
   * Validation is performed through the normal group constructor, ensuring
   * deserialized groups obey the same identity, naming, and membership rules
   * as newly created groups.
   *
   * @param serialized - Serialized group representation.
   *
   * @returns A reconstructed {@link MajikContactGroup}.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the serialized value is invalid or cannot be reconstructed.
   *
   * @example
   * ```ts
   * const group = MajikContactGroup.fromJSON(serialized);
   * ```
   */
  static fromJSON(serialized: SerializedMajikContactGroup): MajikContactGroup {
    if (
      !serialized ||
      typeof serialized !== "object" ||
      Array.isArray(serialized)
    ) {
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

  /**
   * Updates the group's modification timestamp.
   *
   * @internal
   */
  private updateTimestamp(): void {
    this.meta.updatedAt = new Date().toISOString();
  }

  /**
   * Validates a group identifier.
   *
   * @param id - Group identifier to validate.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the ID is not a non-empty string.
   *
   * @internal
   */
  private assertId(id: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError("Group ID must be a non-empty string");
    }
  }

  /**
   * Validates a custom group name.
   *
   * In addition to requiring a non-empty value, custom names are limited to
   * 64 characters and may not collide with reserved system-group names.
   *
   * @param name - Group name to validate.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the name is invalid, too long, or reserved.
   *
   * @internal
   */
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

  /**
   * Validates a contact identifier used for membership operations.
   *
   * @param id - Contact identifier to validate.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the ID is not a non-empty string.
   *
   * @internal
   */
  private assertContactId(id: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError("Contact ID must be a non-empty string");
    }
  }

  /**
   * Validates an initial or batch membership array.
   *
   * Every item must be a non-empty string, and duplicate IDs are rejected.
   *
   * @param ids - Contact IDs to validate.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the value is not an array, contains an invalid ID, or contains
   * duplicate IDs.
   *
   * @internal
   */
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
   * Validates the input to a static set operation.
   *
   * Static {@link merge} and {@link intersect} operations require at least two
   * actual {@link MajikContactGroup} instances.
   *
   * @param groups - Value to validate as a group array.
   * @param operationName - Name of the set operation used in error messages.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the value is not an array, fewer than two groups are supplied,
   * or an item is not a {@link MajikContactGroup}.
   *
   * @internal
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

  /**
   * Validates a static set-operation ID override.
   *
   * @param id - Override identifier to validate.
   * @param fieldName - Name used in the resulting error message.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the override is empty or invalid.
   *
   * @internal
   */
  private static assertStaticId(id: string, fieldName: string): void {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new MajikContactGroupError(
        `${fieldName} must be a non-empty string`,
      );
    }
  }

  /**
   * Validates a static set-operation name override.
   *
   * Static result names follow the same 64-character limit and reserved-name
   * restrictions as custom group names.
   *
   * @param name - Override name to validate.
   * @param fieldName - Name used in the resulting error message.
   *
   * @throws {@link MajikContactGroupError}
   * Thrown when the name is empty, exceeds 64 characters, or conflicts with a
   * reserved system-group name.
   *
   * @internal
   */
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

// Freeze static methods
Object.freeze(MajikContactGroup);

// Freeze instance methods
Object.freeze(MajikContactGroup.prototype);
