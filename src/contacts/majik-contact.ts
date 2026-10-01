/* -------------------------------
 * Types
 * ------------------------------- */

import { MajikContactError } from "../errors";
import {
  MajikContactCard,
  MajikContactData,
  MajikContactMeta,
  MajikMessageIdentityJSON,
  MajikKeyAddress,
  SerializedMajikContact,
  X25519RawKey,
} from "../types";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../utils";

/* -------------------------------
 * MajikContact Class
 * ------------------------------- */

/**
 * Represents a cryptographic contact identity.
 *
 * `MajikContact` stores the public identity material required to identify and
 * communicate with a peer, together with user-defined metadata and contact
 * status.
 *
 * A contact is identified by its application-level `id`, public-key
 * fingerprint, and cryptographic public keys. The model also supports
 * post-quantum key material through the `mlKey`, `mlDsaPublicKeyBase64`, and
 * related fields used by the wider Majikah ecosystem.
 *
 * @typeParam TMeta - Metadata shape associated with the contact. It must extend
 * {@link MajikContactMeta} and may contain additional application-specific
 * fields.
 *
 * @remarks
 * The class is intentionally mutable at the metadata/status level so that
 * consumers can update labels, notes, and blocking state without replacing
 * the contact instance.
 *
 * Static and instance method surfaces are frozen after the class definition.
 *
 * @example
 * ```ts
 * const contact = MajikContact.create(
 *   "user-uuid",
 *   publicKey,
 *   "ml-kem-public-key",
 *   "fingerprint",
 *   {
 *     label: "Alice",
 *     notes: "Met at the conference",
 *   },
 * );
 *
 * contact.updateLabel("Alice (Lead Engineer)");
 * contact.block();
 *
 * console.log(contact.isBlocked()); // true
 * ```
 */
export class MajikContact<TMeta extends MajikContactMeta = MajikContactMeta> {
  /**
   * Application-level identifier for the contact.
   *
   * This value is required to be a non-empty string and is independent of the
   * cryptographic public-key material.
   */
  public readonly id: string;

  /**
   * X25519 public key material associated with the contact.
   *
   * The value may be represented using the supported `X25519RawKey` shape used
   * by the package.
   */
  public readonly publicKey: X25519RawKey;

  /**
   * Human- or application-readable fingerprint identifying the contact's
   * cryptographic identity.
   *
   * This value is required to be a non-empty string.
   */
  public readonly fingerprint: string;

  /**
   * Serialized post-quantum public-key material associated with the contact.
   */
  public readonly mlKey: string;

  /**
   * Base64-encoded Ed25519 public key associated with the contact.
   *
   * An empty string indicates that no value was supplied when the contact was
   * created.
   */
  public readonly edPublicKeyBase64: string;

  /**
   * Base64-encoded ML-DSA public key associated with the contact.
   *
   * An empty string indicates that no value was supplied when the contact was
   * created.
   */
  public readonly mlDsaPublicKeyBase64: string;

  /**
   * Mutable metadata attached to the contact.
   *
   * The metadata includes the base contact fields defined by
   * {@link MajikContactMeta} and may contain application-specific properties
   * through `TMeta`.
   */
  public meta: TMeta;

  /**
   * Cached Majikah registration state.
   *
   * `undefined` means that the registration state has not been established,
   * `true` means the contact is registered, and `false` means the contact is
   * known not to be registered.
   *
   * @internal
   */
  private majikah_registered?: boolean;

  /**
   * Creates a new contact from validated contact data.
   *
   * Metadata defaults are applied automatically for omitted fields.
   *
   * @param data - Contact identity, cryptographic key material, and metadata.
   *
   * @throws {@link MajikContactError}
   * Thrown when the contact ID, public key, ML key, or fingerprint is invalid.
   *
   * @example
   * ```ts
   * const contact = new MajikContact({
   *   id: "user-uuid",
   *   publicKey,
   *   mlKey: "ml-kem-public-key",
   *   fingerprint: "fingerprint",
   *   meta: {
   *     label: "Alice",
   *   },
   * });
   * ```
   */
  constructor(data: MajikContactData<TMeta>) {
    this.assertId(data.id);
    this.assertPublicKey(data.publicKey);
    this.assertMLKey(data.mlKey);
    this.assertFingerprint(data.fingerprint);

    this.id = data.id;
    this.publicKey = data.publicKey;
    this.fingerprint = data.fingerprint;
    this.mlKey = data.mlKey;
    this.edPublicKeyBase64 = data.edPublicKeyBase64 || "";
    this.mlDsaPublicKeyBase64 = data.mlDsaPublicKeyBase64 || "";

    this.majikah_registered = data.majikah_registered;

    this.meta = {
      label: "",
      notes: "",
      blocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data.meta,
    } as TMeta;
  }

  /**
   * Creates a new {@link MajikContact} from its core identity fields.
   *
   * This is the preferred convenience factory when constructing a contact
   * programmatically.
   *
   * @typeParam TMeta - Metadata shape associated with the contact.
   *
   * @param id - Application-level contact identifier.
   * @param publicKey - X25519 public key material.
   * @param mlKey - Post-quantum ML-KEM public-key material.
   * @param fingerprint - Cryptographic identity fingerprint.
   * @param meta - Optional partial metadata to apply on creation.
   * @param edPublicKeyBase64 - Optional Base64-encoded Ed25519 public key.
   * @param mlDsaPublicKeyBase64 - Optional Base64-encoded ML-DSA public key.
   *
   * @returns A newly constructed {@link MajikContact} instance.
   *
   * @throws {@link MajikContactError}
   * Thrown when required identity or key material is invalid.
   *
   * @example
   * ```ts
   * const contact = MajikContact.create(
   *   "user-uuid",
   *   publicKey,
   *   "ml-kem-public-key",
   *   "fingerprint",
   *   {
   *     label: "Alice",
   *     notes: "Met at the conference",
   *   },
   * );
   * ```
   */
  static create<TMeta extends MajikContactMeta = MajikContactMeta>(
    id: string,
    publicKey: X25519RawKey,
    mlKey: string,
    fingerprint: string,
    meta?: Partial<TMeta>,
    edPublicKeyBase64?: string,
    mlDsaPublicKeyBase64?: string,
  ): MajikContact<TMeta> {
    return new MajikContact({
      id,
      publicKey,
      fingerprint,
      meta,
      mlKey,
      edPublicKeyBase64,
      mlDsaPublicKeyBase64,
    });
  }

  /**
   * Throws a contact-specific error.
   *
   * This hook exists so subclasses can customize validation failure handling.
   *
   * @param message - Human-readable validation error message.
   * @param _code - Validation error code reserved for the error-handling layer.
   * @param _field - Optional field associated with the validation failure.
   *
   * @throws {@link MajikContactError}
   */
  protected fail(message: string, _code: string, _field?: string): never {
    throw new MajikContactError(message);
  }

  /**
   * Validates a contact identifier.
   *
   * @param id - Identifier to validate.
   *
   * @throws {@link MajikContactError}
   * Thrown when the identifier is not a non-empty string.
   */
  protected assertId(id: string) {
    if (!id || typeof id !== "string")
      this.fail("Contact ID must be a non-empty string", "INVALID_ID", "id");
  }

  /**
   * Validates post-quantum ML key material.
   *
   * @param key - ML key value to validate.
   *
   * @throws {@link MajikContactError}
   * Thrown when the key is not a non-empty string.
   */
  protected assertMLKey(key: string) {
    if (!key || typeof key !== "string")
      this.fail("ML Key must be a non-empty string", "INVALID_ML_KEY", "mlKey");
  }

  /**
   * Validates X25519 public-key material.
   *
   * The validation accepts the supported public-key representations used by
   * the package, including objects exposing a public-key type or raw key bytes.
   *
   * @param key - Public-key value to validate.
   *
   * @throws {@link MajikContactError}
   * Thrown when the supplied value is not a supported public-key structure.
   */
  protected assertPublicKey(key: X25519RawKey) {
    if (!key)
      this.fail("Invalid public key", "INVALID_PUBLIC_KEY", "publicKey");
    const anyKey: any = key as any;
    if (anyKey && typeof anyKey === "object") {
      if (anyKey.type === "public") return;
      if (anyKey.raw instanceof Uint8Array) return;
    }

    this.fail("Invalid public key", "INVALID_PUBLIC_KEY", "publicKey");
  }

  /**
   * Validates a contact fingerprint.
   *
   * @param fingerprint - Fingerprint to validate.
   *
   * @throws {@link MajikContactError}
   * Thrown when the fingerprint is not a non-empty string.
   */
  protected assertFingerprint(fingerprint: string) {
    if (!fingerprint || typeof fingerprint !== "string")
      this.fail(
        "Fingerprint must be a non-empty string",
        "INVALID_FINGERPRINT",
        "fingerprint",
      );
  }

  /**
   * Updates the metadata timestamp to the current time.
   *
   * @internal
   */
  private updateTimestamp() {
    this.meta.updatedAt = new Date().toISOString();
  }

  /**
   * Partially updates the contact's metadata.
   *
   * Existing metadata is preserved and only the supplied fields are replaced.
   * Custom fields defined by `TMeta` are supported as well.
   *
   * @param updates - Partial metadata changes to merge into the contact.
   *
   * @returns The same contact instance for method chaining.
   *
   * @throws {@link MajikContactError}
   * Thrown when `updates` is not a valid object.
   *
   * @example
   * ```ts
   * contact.updateMeta({
   *   label: "Alice",
   *   notes: "Verified in person",
   * });
   * ```
   */
  updateMeta(updates: Partial<TMeta>): this {
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      throw new MajikContactError(
        "Metadata updates must be provided as a valid object",
      );
    }

    this.meta = {
      ...this.meta,
      ...updates,
    };

    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the contact's display label.
   *
   * @param label - New label for the contact.
   *
   * @returns The same contact instance for method chaining.
   *
   * @throws {@link MajikContactError}
   * Thrown when `label` is not a string.
   *
   * @example
   * ```ts
   * contact.updateLabel("Alice (Lead Engineer)");
   * ```
   */
  updateLabel(label: string): this {
    if (typeof label !== "string")
      throw new MajikContactError("Label must be a string");
    this.meta.label = label;
    this.updateTimestamp();
    return this;
  }

  /**
   * Updates the contact's notes.
   *
   * @param notes - New notes associated with the contact.
   *
   * @returns The same contact instance for method chaining.
   *
   * @throws {@link MajikContactError}
   * Thrown when `notes` is not a string.
   *
   * @example
   * ```ts
   * contact.updateNotes("Met at the conference");
   * ```
   */
  updateNotes(notes: string): this {
    if (typeof notes !== "string")
      throw new MajikContactError("Notes must be a string");
    this.meta.notes = notes;
    this.updateTimestamp();
    return this;
  }

  /**
   * Returns whether the contact is currently blocked.
   *
   * @returns `true` when the contact is blocked; otherwise `false`.
   */
  isBlocked(): boolean {
    return this.meta.blocked || false;
  }

  /**
   * Sets the contact's blocked state.
   *
   * @param blocked - Whether the contact should be blocked.
   *
   * @returns The same contact instance for method chaining.
   *
   * @throws {@link MajikContactError}
   * Thrown when `blocked` is not a boolean.
   *
   * @example
   * ```ts
   * contact.setBlocked(true);
   * ```
   */
  setBlocked(blocked: boolean): this {
    if (typeof blocked !== "boolean")
      throw new MajikContactError("Blocked must be boolean");
    this.meta.blocked = blocked;
    this.updateTimestamp();
    return this;
  }

  /**
   * Blocks the contact.
   *
   * This operation is idempotent: calling `block()` repeatedly leaves the
   * contact in the same blocked state.
   *
   * @returns The same contact instance for method chaining.
   *
   * @example
   * ```ts
   * contact.block();
   * ```
   */
  block(): this {
    if (!this.isBlocked()) this.setBlocked(true);
    return this;
  }

  /**
   * Unblocks the contact.
   *
   * This operation is idempotent: calling `unblock()` repeatedly leaves the
   * contact in the same unblocked state.
   *
   * @returns The same contact instance for method chaining.
   *
   * @example
   * ```ts
   * contact.unblock();
   * ```
   */
  unblock(): this {
    if (this.isBlocked()) this.setBlocked(false);
    return this;
  }

  /**
   * Indicates whether the Majikah registration state has been checked.
   *
   * This differs from {@link isMajikahRegistered}: a contact can be checked
   * and known to be unregistered.
   *
   * @returns `true` when a registration status has been explicitly set,
   * otherwise `false`.
   */
  isMajikahIdentityChecked(): boolean {
    return this.majikah_registered !== undefined;
  }

  /**
   * Returns the known Majikah registration state.
   *
   * An unchecked contact is treated as `false` by this method. Use
   * {@link isMajikahIdentityChecked} when you need to distinguish "unknown"
   * from "not registered".
   *
   * @returns `true` when the contact is marked as registered; otherwise
   * `false`.
   */
  isMajikahRegistered(): boolean {
    return this.majikah_registered || false;
  }

  /**
   * Sets the cached Majikah registration state.
   *
   * @param status - Registration state to store.
   *
   * @returns The same contact instance for method chaining.
   */
  setMajikahStatus(status: boolean): this {
    this.majikah_registered = status;
    return this;
  }

  /**
   * Resolves the most appropriate display name for the contact.
   *
   * The explicit metadata label is preferred. When no label is present, the
   * contact's cryptographic address is used as the fallback.
   *
   * @returns A displayable contact name or address.
   *
   * @example
   * ```ts
   * const name = await contact.getDisplayName();
   * ```
   */
  async getDisplayName(): Promise<string> {
    return this.meta.label || (await this.getAddress());
  }

  /**
   * Returns the Base64-encoded address representation of the contact's public
   * key.
   *
   * @returns A `MajikKeyAddress` derived from the contact's public key bytes.
   *
   * @remarks
   * This method uses the raw public-key bytes exposed by `publicKey`.
   *
   * @example
   * ```ts
   * const address = await contact.getAddress();
   * ```
   */
  async getAddress(): Promise<MajikKeyAddress> {
    return arrayBufferToBase64(this.publicKey.raw.buffer as ArrayBuffer);
  }

  /**
   * Converts the contact into a shareable contact card.
   *
   * The returned card contains the public identity material and display label,
   * but does not include mutable metadata such as notes or timestamps.
   *
   * @returns A normalized {@link MajikContactCard} representation.
   *
   * @example
   * ```ts
   * const card = await contact.toContactCard();
   * ```
   */
  async toContactCard(): Promise<MajikContactCard> {
    let publicKeyBase64: string;
    const anyPub = this.publicKey;
    publicKeyBase64 = arrayBufferToBase64(anyPub.raw.buffer as ArrayBuffer);

    return {
      id: this.id,
      label: this.meta?.label || "",
      publicKey: publicKeyBase64,
      fingerprint: this.fingerprint,
      mlKey: this.mlKey,
      edPublicKeyBase64: this.edPublicKeyBase64,
      mlDsaPublicKeyBase64: this.mlDsaPublicKeyBase64,
    };
  }

  /**
   * Serializes the contact into its persistent JSON-compatible form.
   *
   * The serialized representation includes identity material, metadata,
   * registration state, and supported public keys.
   *
   * @returns A serialized {@link SerializedMajikContact} representation.
   *
   * @example
   * ```ts
   * const serialized = await contact.toJSON();
   * localStorage.setItem("contact", JSON.stringify(serialized));
   * ```
   */
  async toJSON(): Promise<SerializedMajikContact> {
    return {
      id: this.id,
      fingerprint: this.fingerprint,
      meta: { ...this.meta },
      publicKeyBase64: await this.getAddress(),
      majikah_registered: this.majikah_registered,
      mlKey: this.mlKey,
      edPublicKeyBase64: this.edPublicKeyBase64,
      mlDsaPublicKeyBase64: this.mlDsaPublicKeyBase64,
    };
  }

  /**
   * Reconstructs a {@link MajikContact} from its serialized representation.
   *
   * The stored Base64 public key is decoded back into raw key bytes before the
   * contact is recreated.
   *
   * @typeParam TMeta - Metadata shape contained in the serialized contact.
   *
   * @param serialized - Serialized contact data.
   *
   * @returns A reconstructed {@link MajikContact} instance.
   *
   * @throws {@link MajikContactError}
   * Thrown when the serialized data cannot be decoded or used to construct a
   * valid contact.
   *
   * @example
   * ```ts
   * const contact = MajikContact.fromJSON(serializedContact);
   * ```
   */
  static fromJSON<TMeta extends MajikContactMeta = MajikContactMeta>(
    serialized: SerializedMajikContact<TMeta>,
  ): MajikContact<TMeta> {
    try {
      const publicKeyRaw = new Uint8Array(
        base64ToArrayBuffer(serialized.publicKeyBase64),
      );

      return new MajikContact<TMeta>({
        id: serialized.id,
        fingerprint: serialized.fingerprint,
        meta: serialized.meta,
        publicKey: { raw: publicKeyRaw },
        majikah_registered: serialized.majikah_registered,
        mlKey: serialized.mlKey,
        edPublicKeyBase64: serialized.edPublicKeyBase64,
        mlDsaPublicKeyBase64: serialized.mlDsaPublicKeyBase64,
      });
    } catch (err) {
      throw new MajikContactError("Failed to deserialize MajikContact", err);
    }
  }

  /**
   * Creates a contact from a {@link MajikMessageIdentityJSON} identity payload.
   *
   * This adapter is intended for interoperability with Majik Message-style
   * identity objects and derives the contact metadata from the identity
   * payload.
   *
   * @param identityJSON - Serialized message identity information.
   *
   * @returns A newly constructed {@link MajikContact}.
   *
   * @throws {@link MajikContactError}
   * Thrown when the identity payload cannot be decoded or converted into a
   * valid contact.
   *
   * @remarks
   * Contacts created through this adapter are marked as Majikah-registered,
   * and the identity `id` is used as the contact fingerprint.
   *
   * @example
   * ```ts
   * const contact = await MajikContact.fromIdentityJSON(identity);
   * ```
   */
  static async fromIdentityJSON(
    identityJSON: MajikMessageIdentityJSON,
  ): Promise<MajikContact<MajikContactMeta>> {
    try {
      const publicKeyRaw = new Uint8Array(
        base64ToArrayBuffer(identityJSON.public_key),
      );

      const contactData: MajikContactData<MajikContactMeta> = {
        id: identityJSON.id,
        publicKey: { raw: publicKeyRaw },
        fingerprint: identityJSON.id,
        meta: {
          label: identityJSON.label,
          createdAt: identityJSON.timestamp,
          updatedAt: identityJSON.timestamp,
          blocked: identityJSON.restricted,
        },
        majikah_registered: true,
        mlKey: identityJSON.ml_key,
      };

      return new MajikContact(contactData);
    } catch (err) {
      throw new MajikContactError(
        "Failed to create MajikContact from MajikMessageIdentityJSON",
        err,
      );
    }
  }

  /**
   * Checks whether a contact is blocked.
   *
   * This static form is useful when working with a contact reference without
   * needing to invoke the instance method.
   *
   * @param contact - Contact to inspect.
   *
   * @returns `true` when the contact's metadata marks it as blocked.
   *
   * @example
   * ```ts
   * if (MajikContact.isBlocked(contact)) {
   *   // Handle blocked contact
   * }
   * ```
   */
  static isBlocked(contact: MajikContact): boolean {
    return !!contact.meta.blocked;
  }
}

// Freeze static methods
Object.freeze(MajikContact);

// Freeze instance methods
Object.freeze(MajikContact.prototype);
