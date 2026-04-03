export type ISODateString = string;

export type MajikMessageAccountID = string;

export type MajikMessagePublicKey = string;

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

export type SerializedMajikContact = {
  id: string;
  fingerprint: string;
  meta?: MajikContactMeta;
  publicKeyBase64: MajikMessagePublicKey;
  mlKey: string;
  majikah_registered?: boolean;
  edPublicKeyBase64?: string; // Ed25519 public key, base64 (32 bytes)
  mlDsaPublicKeyBase64?: string; // ML-DSA-87 public key, base64 (2592 bytes)
};

export interface MajikContactMeta {
  label?: string;
  notes?: string;
  blocked?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface MajikContactData {
  id: string;
  // publicKey may be a WebCrypto `CryptoKey` or a raw-key wrapper { raw: Uint8Array }
  publicKey: CryptoKey | { raw: Uint8Array };
  fingerprint: string;
  mlKey: string;
  meta?: MajikContactMeta;
  majikah_registered?: boolean;
  edPublicKeyBase64?: string; // Ed25519 public key, base64 (32 bytes)
  mlDsaPublicKeyBase64?: string; // ML-DSA-87 public key, base64 (2592 bytes)
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