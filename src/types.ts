export type ISODateString = string;

/** Base64-encoded public key material. Safe to store, log, or transmit. */
export type MajikKeyAddress = string;

/** Base64-encoded SHA-256 digest of a MajikKey's X25519 public key. Doubles as the account `id`. */
export type MajikKeyFingerprint = string;

export type ED25519PublicKey = string;
export type MLKEM768PublicKey = string;
export type MLDSA87PublicKey = string;
export type BitcoinPublicKey = string;

export type ED25519RawPublicKey = Uint8Array;
export type MLKEM768RawPublicKey = Uint8Array;
export type MLDSA87RawPublicKey = Uint8Array;
export type BitcoinRawPublicKey = Uint8Array;

export interface X25519RawKey {
  raw: Uint8Array;
}


export interface MAJIK_API_RESPONSE {
  success: boolean;
  message: string;
  code?: string;
}

export interface MajikMessageIdentityJSON {
  id: string;
  user_id: string;
  public_key: string;
  ml_key: string;
  phash: string;
  label: string;
  timestamp: string;
  restricted: boolean;
}

export type SerializedMajikContact<
  TMeta extends MajikContactMeta = MajikContactMeta,
> = {
  id: string;
  fingerprint: string;
  meta?: TMeta; // Uses the generic type here
  publicKeyBase64: MajikKeyAddress;
  mlKey: string;
  majikah_registered?: boolean;
  edPublicKeyBase64?: string;
  mlDsaPublicKeyBase64?: string;
};

export interface MajikContactMeta {
  label?: string;
  notes?: string;
  blocked?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface MajikContactData<
  TMeta extends MajikContactMeta = MajikContactMeta,
> {
  id: string;
  publicKey: X25519RawKey;
  fingerprint: string;
  mlKey: string;
  meta?: Partial<TMeta>; // Allows partial data passed during initialization
  majikah_registered?: boolean;
  edPublicKeyBase64?: string;
  mlDsaPublicKeyBase64?: string;
}

export interface MajikContactCard {
  id: string;
  publicKey: string;
  fingerprint: string;
  label: string;
  mlKey: string;
  edPublicKeyBase64?: string; // Ed25519 public key, base64 (32 bytes)
  mlDsaPublicKeyBase64?: string; // ML-DSA-87 public key, base64 (2592 bytes)
}

/* -------------------------------
 * Types
 * ------------------------------- */

export interface MajikContactGroupMeta {
  name: string;
  description: string;
  photoBase64: string | null;
  createdAt: string;
  updatedAt: string;
  color?: string;
}

export interface MajikContactGroupData {
  id: string;
  meta?: Partial<MajikContactGroupMeta>;
  memberIds?: string[];
  isSystem?: boolean;
}

export interface SerializedMajikContactGroup {
  id: string;
  meta: MajikContactGroupMeta;
  memberIds: string[];
  isSystem: boolean;
}

export interface MajikContactGroupSetOptions {
  /**
   * Override the ID for the resulting group.
   * Defaults to the ID of the first group in the array when not provided.
   */
  id?: string;
  /**
   * Override the name for the resulting group.
   * Defaults to the name of the first group in the array when not provided.
   */
  name?: string;
}
