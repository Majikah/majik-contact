/* ================================
 * Utilities
 * ================================ */

import { SYSTEM_GROUP_IDS, SystemGroupId } from "./constants";
import { MajikContactGroupError } from "./errors";

// utils/utilities.ts
export function arrayToBase64(data: Uint8Array): string {
  let binary = "";
  const bytes = data;
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export function base64ToUtf8(base64: string): string {
  const buf = base64ToArrayBuffer(base64);
  return new TextDecoder().decode(new Uint8Array(buf));
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64(bytes.buffer);
}

export function concatArrayBuffers(
  a: ArrayBuffer,
  b: ArrayBuffer,
): ArrayBuffer {
  const tmp = new Uint8Array(a.byteLength + b.byteLength);
  tmp.set(new Uint8Array(a), 0);
  tmp.set(new Uint8Array(b), a.byteLength);
  return tmp.buffer;
}

export function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

/**
 * Accepts any photo input format and always returns a base64 data-URL string.
 *
 * Supported inputs:
 *  - Already a base64 data-URL  → returned as-is
 *  - Raw base64 string (no prefix) → prefixed with a generic data-URL header
 *  - HTTP/HTTPS URL              → fetched and converted to base64
 *  - Blob / File                 → read via FileReader
 *  - ArrayBuffer / Uint8Array    → converted directly
 */
export async function normalizePhotoToBase64(input: unknown): Promise<string> {
  if (input === null || input === undefined) {
    throw new MajikContactGroupError(
      "Photo input must not be null or undefined",
    );
  }

  // Already a data-URL
  if (typeof input === "string" && input.startsWith("data:")) {
    assertValidDataUrl(input);
    return input;
  }

  // HTTP/HTTPS URL — fetch and convert
  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    try {
      const response = await fetch(input);
      if (!response.ok) {
        throw new MajikContactGroupError(
          `Failed to fetch photo from URL: HTTP ${response.status}`,
        );
      }
      const blob = await response.blob();
      return blobToBase64DataUrl(blob);
    } catch (err) {
      if (err instanceof MajikContactGroupError) throw err;
      throw new MajikContactGroupError("Failed to fetch photo from URL", err);
    }
  }

  // Raw base64 string (no protocol/data prefix) — wrap with a generic image header
  if (typeof input === "string") {
    if (!isValidBase64(input)) {
      throw new MajikContactGroupError(
        "Photo string is not a valid base64 string or recognized URL format",
      );
    }
    return `data:image/jpeg;base64,${input}`;
  }

  // Blob or File
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return blobToBase64DataUrl(input);
  }

  // ArrayBuffer
  if (input instanceof ArrayBuffer) {
    return arrayBufferToBase64DataUrl(input);
  }

  // Uint8Array (or any typed array)
  if (ArrayBuffer.isView(input)) {
    return arrayBufferToBase64DataUrl(
      (input as Uint8Array).buffer as ArrayBuffer,
    );
  }

  throw new MajikContactGroupError(
    `Unsupported photo input type: ${typeof input}. ` +
      "Expected a base64 string, data-URL, HTTP URL, Blob, File, ArrayBuffer, or Uint8Array.",
  );
}

function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      try {
        assertValidDataUrl(result);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () =>
      reject(
        new MajikContactGroupError(
          "FileReader failed to read blob",
          reader.error,
        ),
      );
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToBase64DataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}

function isValidBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  // Allow standard and URL-safe base64, with optional padding
  return /^[A-Za-z0-9+/\-_]*={0,2}$/.test(str);
}

function assertValidDataUrl(dataUrl: string): void {
  if (
    !/^data:[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*;base64,[A-Za-z0-9+/\-_]+=*$/.test(
      dataUrl,
    )
  ) {
    throw new MajikContactGroupError(
      "Invalid data-URL format. Expected: data:<mediatype>;base64,<data>",
    );
  }
}

export function isSystemGroupId(id: string): id is SystemGroupId {
  return Object.values(SYSTEM_GROUP_IDS).includes(id as SystemGroupId);
}
