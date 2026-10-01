/* -------------------------------
 * Shared / Cryptographic Types
 * ------------------------------- */

/**
 * ISO 8601 date-time string.
 *
 * This alias documents string values used for timestamps throughout the
 * Majikah data models.
 *
 * @example
 * ```ts
 * const createdAt: ISODateString = new Date().toISOString();
 * ```
 */
export type ISODateString = string;

/**
 * Base64-encoded public-key material.
 *
 * This is the encoded representation used when a public key needs to be
 * persisted, serialized, or transmitted as a string.
 *
 * @remarks
 * This type represents public information and does not contain private key
 * material.
 */
export type MajikKeyAddress = string;

/**
 * Base64-encoded SHA-256 fingerprint of a MajikKey's X25519 public key.
 *
 * The fingerprint also serves as the account `id` within the MajikKey identity
 * model.
 *
 * @remarks
 * Fingerprints are intended to provide a stable, compact identifier for a
 * cryptographic identity without exposing the raw key material directly.
 */
export type MajikKeyFingerprint = string;

/**
 * Base64-encoded Ed25519 public key.
 *
 * Represents the serialized public-key form intended for storage or transport.
 */
export type ED25519PublicKey = string;

/**
 * Base64-encoded ML-KEM-768 public key.
 *
 * Represents the serialized post-quantum public-key form intended for storage
 * or transport.
 */
export type MLKEM768PublicKey = string;

/**
 * Base64-encoded ML-DSA-87 public key.
 *
 * Represents the serialized post-quantum signing public-key form intended for
 * storage or transport.
 */
export type MLDSA87PublicKey = string;

/**
 * Base64-encoded Bitcoin public key.
 *
 * Represents the serialized public-key form intended for storage or transport.
 */
export type BitcoinPublicKey = string;

/**
 * Raw Ed25519 public-key bytes.
 *
 * This is the binary/in-memory representation of an Ed25519 public key.
 */
export type ED25519RawPublicKey = Uint8Array;

/**
 * Raw ML-KEM-768 public-key bytes.
 *
 * This is the binary/in-memory representation of an ML-KEM-768 public key.
 */
export type MLKEM768RawPublicKey = Uint8Array;

/**
 * Raw ML-DSA-87 public-key bytes.
 *
 * This is the binary/in-memory representation of an ML-DSA-87 public key.
 */
export type MLDSA87RawPublicKey = Uint8Array;

/**
 * Raw Bitcoin public-key bytes.
 *
 * This is the binary/in-memory representation of a Bitcoin public key.
 */
export type BitcoinRawPublicKey = Uint8Array;

/**
 * Wrapper for raw X25519 public-key bytes.
 *
 * `X25519RawKey` provides the normalized raw-key shape used by the contact
 * model when WebCrypto key objects are unavailable or when raw public-key
 * material is preferred.
 *
 * @example
 * ```ts
 * const publicKey: X25519RawKey = {
 *   raw: new Uint8Array(32),
 * };
 * ```
 */
export interface X25519RawKey {
  /**
   * Raw X25519 public-key bytes.
   */
  raw: Uint8Array;
}

/* -------------------------------
 * API Types
 * ------------------------------- */

/**
 * Common response envelope returned by Majikah API operations.
 *
 * @remarks
 * The `code` field is optional and may provide a machine-readable status or
 * error code when one is available.
 */
export interface MAJIK_API_RESPONSE {
  /**
   * Indicates whether the API operation completed successfully.
   */
  success: boolean;

  /**
   * Human-readable response or status message.
   */
  message: string;

  /**
   * Optional machine-readable response code.
   */
  code?: string;
}

/**
 * Serialized identity payload used by Majik Message-compatible identity data.
 *
 * This shape represents the JSON-facing form of a cryptographic identity and
 * contains the public identity information required to reconstruct a
 * {@link MajikContact}.
 *
 * @remarks
 * Public-key fields are represented as strings because this type is intended
 * for JSON serialization and transport rather than raw cryptographic
 * operations.
 */
export interface MajikMessageIdentityJSON {
  /**
   * Account or identity identifier.
   */
  id: string;

  /**
   * User identifier associated with the identity.
   */
  user_id: string;

  /**
   * Base64-encoded X25519 public key.
   */
  public_key: string;

  /**
   * Serialized ML-KEM public key.
   */
  ml_key: string;

  /**
   * Public identity hash associated with the message identity.
   */
  phash: string;

  /**
   * Human-readable identity label.
   */
  label: string;

  /**
   * ISO-formatted identity timestamp.
   */
  timestamp: string;

  /**
   * Indicates whether the identity is restricted.
   */
  restricted: boolean;
}

/* -------------------------------
 * Majik Contact Types
 * ------------------------------- */

/**
 * JSON-serializable representation of a {@link MajikContact}.
 *
 * This type is intended for persistence and transport rather than direct
 * cryptographic operations. Raw public-key bytes are converted to a Base64
 * string through `publicKeyBase64`.
 *
 * @typeParam TMeta - Application-specific metadata extending
 * {@link MajikContactMeta}.
 *
 * @remarks
 * Metadata is optional here because serialized data may originate from older
 * or partial persisted records.
 */
export type SerializedMajikContact<
  TMeta extends MajikContactMeta = MajikContactMeta,
> = {
  /**
   * Application-level contact identifier.
   */
  id: string;

  /**
   * Cryptographic identity fingerprint.
   */
  fingerprint: string;

  /**
   * Persisted contact metadata.
   */
  meta?: TMeta;

  /**
   * Base64-encoded X25519 public-key material.
   */
  publicKeyBase64: MajikKeyAddress;

  /**
   * Serialized post-quantum ML-KEM public-key material.
   */
  mlKey: string;

  /**
   * Cached Majikah registration state.
   *
   * `undefined` means no registration state has been recorded.
   */
  majikah_registered?: boolean;

  /**
   * Base64-encoded Ed25519 public key.
   */
  edPublicKeyBase64?: string;

  /**
   * Base64-encoded ML-DSA-87 public key.
   */
  mlDsaPublicKeyBase64?: string;
};

/**
 * Metadata attached to a {@link MajikContact}.
 *
 * All fields are optional so callers can provide only the metadata they need.
 * The `MajikContact` class applies its own defaults when constructing a
 * contact.
 *
 * @remarks
 * Applications may extend this interface with additional metadata fields
 * through the generic `TMeta` parameter supported by the contact model.
 */
export interface MajikContactMeta {
  /**
   * Human-readable label used when displaying the contact.
   */
  label?: string;

  /**
   * Free-form notes associated with the contact.
   */
  notes?: string;

  /**
   * Whether the contact is currently blocked.
   */
  blocked?: boolean;

  /**
   * Contact creation timestamp.
   */
  createdAt?: ISODateString;

  /**
   * Timestamp of the most recent metadata update.
   */
  updatedAt?: ISODateString;
}

/**
 * Initialization data used to construct a {@link MajikContact}.
 *
 * This shape is intended for in-memory construction. Unlike
 * {@link SerializedMajikContact}, the X25519 public key is represented using
 * the package's raw-key wrapper rather than a Base64 string.
 *
 * @typeParam TMeta - Application-specific metadata extending
 * {@link MajikContactMeta}.
 */
export interface MajikContactData<
  TMeta extends MajikContactMeta = MajikContactMeta,
> {
  /**
   * Application-level contact identifier.
   */
  id: string;

  /**
   * X25519 public-key material used by the contact.
   */
  publicKey: X25519RawKey;

  /**
   * Cryptographic identity fingerprint.
   */
  fingerprint: string;

  /**
   * Serialized post-quantum ML-KEM public-key material.
   */
  mlKey: string;

  /**
   * Optional partial metadata used during contact initialization.
   *
   * The contact class fills in default metadata values for omitted properties.
   */
  meta?: Partial<TMeta>;

  /**
   * Optional cached Majikah registration state.
   *
   * `undefined` represents an unchecked or unknown state.
   */
  majikah_registered?: boolean;

  /**
   * Optional Base64-encoded Ed25519 public key.
   */
  edPublicKeyBase64?: string;

  /**
   * Optional Base64-encoded ML-DSA-87 public key.
   */
  mlDsaPublicKeyBase64?: string;
}

/**
 * Compact public contact representation intended for sharing or exchange.
 *
 * Unlike {@link SerializedMajikContact}, this shape exposes only the contact
 * identity information needed to represent the public contact card and does
 * not include mutable metadata such as notes or timestamps.
 *
 * @remarks
 * Public-key material is represented as Base64 strings for convenient
 * serialization and transport.
 */
export interface MajikContactCard {
  /**
   * Application-level contact identifier.
   */
  id: string;

  /**
   * Base64-encoded X25519 public-key material.
   */
  publicKey: string;

  /**
   * Cryptographic identity fingerprint.
   */
  fingerprint: string;

  /**
   * Human-readable contact label.
   */
  label: string;

  /**
   * Serialized post-quantum ML-KEM public-key material.
   */
  mlKey: string;

  /**
   * Optional Base64-encoded Ed25519 public key.
   *
   * Expected Ed25519 public-key size is 32 bytes before Base64 encoding.
   */
  edPublicKeyBase64?: string;

  /**
   * Optional Base64-encoded ML-DSA-87 public key.
   *
   * Expected ML-DSA-87 public-key size is 2592 bytes before Base64 encoding.
   */
  mlDsaPublicKeyBase64?: string;
}

/* -------------------------------
 * Contact Group Types
 * ------------------------------- */

/**
 * Mutable metadata associated with a {@link MajikContactGroup}.
 *
 * Unlike contact metadata, group metadata requires a name, description,
 * photo field, and timestamps because these values are normalized by the
 * group model during construction.
 */
export interface MajikContactGroupMeta {
  /**
   * Human-readable group name.
   *
   * Custom groups are subject to the group's naming validation rules.
   * System-group names are controlled by the package.
   */
  name: string;

  /**
   * Human-readable description of the group.
   */
  description: string;

  /**
   * Group photo normalized to a Base64 data URL.
   *
   * `null` indicates that no photo is currently assigned.
   */
  photoBase64: string | null;

  /**
   * Timestamp at which the group was created.
   */
  createdAt: string;

  /**
   * Timestamp of the most recent group metadata or membership update.
   */
  updatedAt: string;

  /**
   * Optional UI/application color associated with the group.
   */
  color?: string;
}

/**
 * Initialization data used to construct a {@link MajikContactGroup}.
 *
 * All metadata and membership fields other than `id` are optional so callers
 * can construct a group with sensible defaults.
 */
export interface MajikContactGroupData {
  /**
   * Application-level group identifier.
   */
  id: string;

  /**
   * Optional initial group metadata.
   *
   * Missing fields are populated by the group constructor.
   */
  meta?: Partial<MajikContactGroupMeta>;

  /**
   * Optional initial contact membership.
   *
   * Each ID must be a non-empty string and the supplied array must not contain
   * duplicates.
   */
  memberIds?: string[];

  /**
   * Marks the group as a system-managed group.
   *
   * System groups use package-defined behavior and reserved names.
   */
  isSystem?: boolean;
}

/**
 * JSON-serializable representation of a {@link MajikContactGroup}.
 *
 * Membership is serialized as a string array rather than the group's internal
 * `Set<string>` representation.
 */
export interface SerializedMajikContactGroup {
  /**
   * Application-level group identifier.
   */
  id: string;

  /**
   * Complete normalized group metadata.
   */
  meta: MajikContactGroupMeta;

  /**
   * Contact IDs belonging to the group.
   */
  memberIds: string[];

  /**
   * Indicates whether this is a system-managed group.
   */
  isSystem: boolean;
}

/**
 * Options for static group set operations such as
 * {@link MajikContactGroup.merge} and {@link MajikContactGroup.intersect}.
 *
 * These options affect only the identity metadata of the newly created result
 * group; membership is derived from the source groups.
 */
export interface MajikContactGroupSetOptions {
  /**
   * Override the ID of the resulting group.
   *
   * When omitted, the resulting group uses the ID of the first source group.
   */
  id?: string;

  /**
   * Override the name of the resulting group.
   *
   * When omitted, the resulting group uses the name of the first source group.
   */
  name?: string;
}
