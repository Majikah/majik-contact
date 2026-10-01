import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { MajikContact } from "../src/contacts/majik-contact";
import { MajikContactGroup } from "../src/contacts/majik-contact-group";
import { MajikContactError, MajikContactGroupError } from "../src/errors";
import {
  MajikContactData,
  MajikContactGroupMeta,
  MajikContactMeta,
  MajikMessageIdentityJSON,
  X25519RawKey,
} from "../src/types";
import { SYSTEM_GROUP_IDS, SYSTEM_GROUP_NAMES } from "../src/constants";

import { getTestKey } from "./helpers/crypto";
import { MajikKey } from "@majikah/majik-key";

/* ============================================================================
 * Shared Real-Key Fixtures
 * ========================================================================== */

let keyA: MajikKey;
let keyB: MajikKey;
let keyC: MajikKey;

let contactA: MajikContact;
let contactB: MajikContact;
let contactC: MajikContact;

/**
 * Creates a local MajikContact from a real MajikKey identity.
 *
 * This intentionally goes through MajikKey.toContact() so the valid contact
 * fixtures exercise the real MajikKey -> MajikContact interoperability path.
 *
 * Malformed/negative tests still construct intentionally invalid values
 * directly so validation behavior remains isolated and precise.
 */
function contactFromKey(key: MajikKey): MajikContact {
  const source = key.toContact();

  return MajikContact.create(
    source.id,
    source.publicKey as X25519RawKey,
    source.mlKey,
    source.fingerprint,
    source.meta,
    source.edPublicKeyBase64,
    source.mlDsaPublicKeyBase64,
  );
}

/**
 * Computes Base64 independently of the implementation under test.
 */
function expectedBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/**
 * Creates a contact based on the first real cryptographic fixture while
 * allowing individual fields to be overridden for targeted validation tests.
 */
function createContact<TMeta extends MajikContactMeta = MajikContactMeta>(
  meta?: Partial<TMeta>,
  overrides: Partial<MajikContactData<TMeta>> = {},
): MajikContact<TMeta> {
  return new MajikContact<TMeta>({
    id: contactA.id,
    publicKey: contactA.publicKey,
    fingerprint: contactA.fingerprint,
    mlKey: contactA.mlKey,
    meta,
    edPublicKeyBase64: contactA.edPublicKeyBase64,
    mlDsaPublicKeyBase64: contactA.mlDsaPublicKeyBase64,
    ...overrides,
  });
}

/**
 * Creates a test group with convenient defaults.
 */
function createGroup(
  id = "group-001",
  name = "Test Group",
  meta?: Partial<Omit<MajikContactGroupMeta, "name">>,
  memberIds?: string[],
): MajikContactGroup {
  return MajikContactGroup.create(id, name, meta, memberIds);
}

/**
 * Advances the fake system clock to an exact ISO timestamp.
 */
function advanceTime(iso: string): void {
  vi.setSystemTime(new Date(iso));
}

/**
 * Asserts that a synchronous operation throws MajikContactError.
 *
 * The supplied function is executed exactly once. This avoids the TypeScript
 * issue caused by trying to chain another matcher after `toThrow()`, whose
 * Vitest return type is void in the installed typings.
 */
function expectContactError(
  fn: () => unknown,
  message?: string | RegExp,
): void {
  let thrown: unknown;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(MajikContactError);

  if (message !== undefined) {
    const actualMessage =
      thrown instanceof Error ? thrown.message : String(thrown);

    if (typeof message === "string") {
      expect(actualMessage).toContain(message);
    } else {
      expect(actualMessage).toMatch(message);
    }
  }
}

/**
 * Asserts that a synchronous operation throws MajikContactGroupError.
 *
 * The supplied function is executed exactly once.
 */
function expectGroupError(fn: () => unknown, message?: string | RegExp): void {
  let thrown: unknown;

  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(MajikContactGroupError);

  if (message !== undefined) {
    const actualMessage =
      thrown instanceof Error ? thrown.message : String(thrown);

    if (typeof message === "string") {
      expect(actualMessage).toContain(message);
    } else {
      expect(actualMessage).toMatch(message);
    }
  }
}

/* ============================================================================
 * Generate REAL cryptographic identities once for the whole suite
 * ========================================================================== */

beforeAll(async () => {
  console.log("[majik-key] Generating shared key pool (3 keys, parallel)...");
  [keyA, keyB, keyC] = await Promise.all([
    getTestKey(),
    getTestKey(),
    getTestKey(),
  ]);

  contactA = contactFromKey(keyA);
  contactB = contactFromKey(keyB);
  contactC = contactFromKey(keyC);

  /*
   * Make absolutely sure the fixtures are independent real identities.
   */
  expect(new Set([keyA.id, keyB.id, keyC.id]).size).toBe(3);

  expect(
    new Set([keyA.fingerprint, keyB.fingerprint, keyC.fingerprint]).size,
  ).toBe(3);

  expect(contactA.publicKey.raw).toBeInstanceOf(Uint8Array);

  expect(contactB.publicKey.raw).toBeInstanceOf(Uint8Array);

  expect(contactC.publicKey.raw).toBeInstanceOf(Uint8Array);
}, 120000);

afterAll(() => {
  /*
   * Purge private key material from the real test identities after the suite.
   */
  keyA?.lock();
  keyB?.lock();
  keyC?.lock();

  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ============================================================================
 * MAJIK CONTACT
 * ========================================================================== */

describe("MajikContact", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    advanceTime("2026-01-01T00:00:00.000Z");
  });

  /* --------------------------------------------------------------------------
   * Real MajikKey Integration
   * ------------------------------------------------------------------------ */

  describe("real MajikKey integration", () => {
    it("creates valid contacts from real MajikKey identities", () => {
      expect(contactA).toBeInstanceOf(MajikContact);
      expect(contactB).toBeInstanceOf(MajikContact);
      expect(contactC).toBeInstanceOf(MajikContact);
    });

    it("uses the real X25519 public key representation", () => {
      expect(contactA.publicKey).toBeDefined();
      expect(contactA.publicKey.raw).toBeInstanceOf(Uint8Array);
      expect(contactA.publicKey.raw.length).toBeGreaterThan(0);
    });

    it("preserves the real key fingerprint", () => {
      expect(contactA.fingerprint).toBe(keyA.fingerprint);

      expect(contactB.fingerprint).toBe(keyB.fingerprint);

      expect(contactC.fingerprint).toBe(keyC.fingerprint);
    });

    it("uses distinct cryptographic identity material for independently generated keys", () => {
      expect(contactA.id).not.toBe(contactB.id);
      expect(contactA.id).not.toBe(contactC.id);
      expect(contactB.id).not.toBe(contactC.id);

      expect(contactA.fingerprint).not.toBe(contactB.fingerprint);

      expect(contactA.publicKey.raw).not.toEqual(contactB.publicKey.raw);

      expect(contactB.publicKey.raw).not.toEqual(contactC.publicKey.raw);
    });

    it("preserves real post-quantum public key material", () => {
      expect(contactA.mlKey).toBeTruthy();
      expect(contactA.mlDsaPublicKeyBase64).toBeTruthy();
    });

    it("preserves real Ed25519 public key material when supplied", () => {
      expect(contactA.edPublicKeyBase64).toBeTruthy();
    });

    it("produces an address from the real X25519 public key", async () => {
      const address = await contactA.getAddress();

      expect(address).toBe(expectedBase64(contactA.publicKey.raw));

      expect(address.length).toBeGreaterThan(0);
    });
  });

  /* --------------------------------------------------------------------------
   * Construction and Defaults
   * ------------------------------------------------------------------------ */

  describe("construction and defaults", () => {
    it("creates a valid contact from the constructor", () => {
      const contact = createContact();

      expect(contact).toBeInstanceOf(MajikContact);
      expect(contact.id).toBe(contactA.id);
      expect(contact.publicKey).toBe(contactA.publicKey);
      expect(contact.fingerprint).toBe(contactA.fingerprint);
      expect(contact.mlKey).toBe(contactA.mlKey);

      expect(contact.edPublicKeyBase64).toBe(contactA.edPublicKeyBase64);

      expect(contact.mlDsaPublicKeyBase64).toBe(contactA.mlDsaPublicKeyBase64);

      expect(contact.meta.label).toBe("");
      expect(contact.meta.notes).toBe("");
      expect(contact.meta.blocked).toBe(false);
      expect(contact.meta.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(contact.meta.updatedAt).toBe("2026-01-01T00:00:00.000Z");

      expect(contact.isMajikahIdentityChecked()).toBe(false);

      expect(contact.isMajikahRegistered()).toBe(false);
    });

    it("applies supplied metadata over defaults", () => {
      const contact = createContact({
        label: "Alice",
        notes: "Met at conference",
        blocked: true,
        createdAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2025-12-02T00:00:00.000Z",
      });

      expect(contact.meta).toEqual({
        label: "Alice",
        notes: "Met at conference",
        blocked: true,
        createdAt: "2025-12-01T00:00:00.000Z",
        updatedAt: "2025-12-02T00:00:00.000Z",
      });
    });

    it("preserves optional public signing keys", () => {
      const contact = createContact(undefined, {
        edPublicKeyBase64: "ed-test",
        mlDsaPublicKeyBase64: "mldsa-test",
      });

      expect(contact.edPublicKeyBase64).toBe("ed-test");

      expect(contact.mlDsaPublicKeyBase64).toBe("mldsa-test");
    });

    it("normalizes omitted optional public signing keys to empty strings", () => {
      const contact = createContact(undefined, {
        edPublicKeyBase64: undefined,
        mlDsaPublicKeyBase64: undefined,
      });

      expect(contact.edPublicKeyBase64).toBe("");
      expect(contact.mlDsaPublicKeyBase64).toBe("");
    });

    it("supports extended metadata through the generic type", () => {
      interface CustomMeta extends MajikContactMeta {
        department?: string;
        trustLevel?: number;
      }

      const contact = MajikContact.create<CustomMeta>(
        contactA.id,
        contactA.publicKey,
        contactA.mlKey,
        contactA.fingerprint,
        {
          label: "Alice",
          department: "Engineering",
          trustLevel: 3,
        },
      );

      expect(contact.meta.department).toBe("Engineering");

      expect(contact.meta.trustLevel).toBe(3);

      contact.updateMeta({
        department: "Security",
        trustLevel: 5,
      });

      expect(contact.meta.department).toBe("Security");

      expect(contact.meta.trustLevel).toBe(5);
    });

    it("creates equivalent identity data through static create()", () => {
      const contact = MajikContact.create(
        contactA.id,
        contactA.publicKey,
        contactA.mlKey,
        contactA.fingerprint,
        {
          label: "Alice",
        },
        contactA.edPublicKeyBase64,
        contactA.mlDsaPublicKeyBase64,
      );

      expect(contact.id).toBe(contactA.id);
      expect(contact.publicKey).toBe(contactA.publicKey);
      expect(contact.fingerprint).toBe(contactA.fingerprint);
      expect(contact.mlKey).toBe(contactA.mlKey);
      expect(contact.meta.label).toBe("Alice");
      expect(contact.edPublicKeyBase64).toBe(contactA.edPublicKeyBase64);
      expect(contact.mlDsaPublicKeyBase64).toBe(contactA.mlDsaPublicKeyBase64);
    });
  });

  /* --------------------------------------------------------------------------
   * Constructor Validation
   * ------------------------------------------------------------------------ */

  describe("constructor validation", () => {
    it("rejects completely missing data", () => {
      expectContactError(() => {
        new MajikContact({} as any);
      }, "Contact ID must be a non-empty string");
    });

    it.each([
      ["empty string", ""],
      ["null", null],
      ["undefined", undefined],
      ["number", 123],
      ["boolean", true],
      ["object", {}],
      ["array", []],
    ])("rejects invalid IDs: %s", (_label, id) => {
      expectContactError(() => {
        new MajikContact({
          id: id as any,
          publicKey: contactA.publicKey,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Contact ID must be a non-empty string");
    });

    it("currently accepts whitespace-only IDs because validation does not trim", () => {
      const contact = createContact(undefined, {
        id: "   ",
      });

      expect(contact.id).toBe("   ");
    });

    it("rejects null public keys", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: null as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("rejects undefined public keys", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: undefined as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("accepts the current { raw: Uint8Array } public-key shape", () => {
      expect(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: {
            raw: contactA.publicKey.raw,
          },
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }).not.toThrow();
    });

    it("rejects a bare Uint8Array under the current class implementation", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: contactA.publicKey.raw as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("rejects a raw-key wrapper containing a plain array", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: {
            raw: [1, 2, 3],
          } as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("rejects a raw-key wrapper containing null", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: {
            raw: null,
          } as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("rejects an empty public-key object", () => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: {} as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }, "Invalid public key");
    });

    it("accepts a zero-length raw Uint8Array because validation is structural", () => {
      const contact = createContact(undefined, {
        publicKey: {
          raw: new Uint8Array(),
        },
      });

      expect(contact.publicKey.raw).toEqual(new Uint8Array());
    });

    it("still accepts the legacy { type: 'public' } validation shape", () => {
      expect(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: {
            type: "public",
          } as any,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        });
      }).not.toThrow();
    });

    it.each([
      ["empty string", ""],
      ["null", null],
      ["undefined", undefined],
      ["number", 123],
      ["boolean", false],
      ["object", {}],
      ["array", []],
    ])("rejects invalid ML keys: %s", (_label, value) => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: contactA.publicKey,
          fingerprint: contactA.fingerprint,
          mlKey: value as any,
        });
      }, "ML Key must be a non-empty string");
    });

    it("accepts whitespace-only ML keys because validation does not trim", () => {
      const contact = createContact(undefined, {
        mlKey: "   ",
      });

      expect(contact.mlKey).toBe("   ");
    });

    it.each([
      ["empty string", ""],
      ["null", null],
      ["undefined", undefined],
      ["number", 123],
      ["boolean", false],
      ["object", {}],
      ["array", []],
    ])("rejects invalid fingerprints: %s", (_label, value) => {
      expectContactError(() => {
        new MajikContact({
          id: contactA.id,
          publicKey: contactA.publicKey,
          fingerprint: value as any,
          mlKey: contactA.mlKey,
        });
      }, "Fingerprint must be a non-empty string");
    });

    it("accepts whitespace-only fingerprints because validation does not trim", () => {
      const contact = createContact(undefined, {
        fingerprint: "   ",
      });

      expect(contact.fingerprint).toBe("   ");
    });
  });

  /* --------------------------------------------------------------------------
   * Metadata Mutation
   * ------------------------------------------------------------------------ */

  describe("metadata mutation", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = createContact();
    });

    it("updates metadata partially", () => {
      const result = contact.updateMeta({
        label: "Alice",
        notes: "Verified",
      });

      expect(result).toBe(contact);
      expect(contact.meta.label).toBe("Alice");
      expect(contact.meta.notes).toBe("Verified");
      expect(contact.meta.blocked).toBe(false);
    });

    it("preserves unspecified metadata", () => {
      contact.updateMeta({
        label: "Alice",
      });

      expect(contact.meta.label).toBe("Alice");
      expect(contact.meta.notes).toBe("");
      expect(contact.meta.blocked).toBe(false);
    });

    it.each([
      ["null", null],
      ["undefined", undefined],
      ["string", "invalid"],
      ["number", 42],
      ["boolean", true],
      ["array", []],
      ["function", () => undefined],
    ])("rejects invalid updateMeta values: %s", (_label, value) => {
      expectContactError(() => {
        contact.updateMeta(value as any);
      }, "Metadata updates must be provided as a valid object");
    });

    it("accepts an empty update object", () => {
      expect(() => {
        contact.updateMeta({});
      }).not.toThrow();
    });

    it("updates updatedAt through updateMeta()", () => {
      advanceTime("2026-01-01T00:01:00.000Z");

      contact.updateMeta({
        label: "Updated",
      });

      expect(contact.meta.updatedAt).toBe("2026-01-01T00:01:00.000Z");
    });

    it("updates the label", () => {
      const result = contact.updateLabel("Alice");

      expect(result).toBe(contact);
      expect(contact.meta.label).toBe("Alice");
    });

    it("allows clearing a label", () => {
      contact.updateLabel("Alice");
      contact.updateLabel("");

      expect(contact.meta.label).toBe("");
    });

    it.each([null, undefined, 123, false, {}, []])(
      "rejects non-string labels: %s",
      (value) => {
        expectContactError(() => {
          contact.updateLabel(value as any);
        }, "Label must be a string");
      },
    );

    it("updates notes", () => {
      const result = contact.updateNotes("Met at conference");

      expect(result).toBe(contact);
      expect(contact.meta.notes).toBe("Met at conference");
    });

    it("allows clearing notes", () => {
      contact.updateNotes("Some notes");
      contact.updateNotes("");

      expect(contact.meta.notes).toBe("");
    });

    it.each([null, undefined, 123, false, {}, []])(
      "rejects non-string notes: %s",
      (value) => {
        expectContactError(() => {
          contact.updateNotes(value as any);
        }, "Notes must be a string");
      },
    );

    it("preserves createdAt while changing updatedAt", () => {
      const createdAt = contact.meta.createdAt;

      advanceTime("2026-01-01T01:00:00.000Z");

      contact.updateLabel("Alice");

      expect(contact.meta.createdAt).toBe(createdAt);
      expect(contact.meta.updatedAt).toBe("2026-01-01T01:00:00.000Z");
    });
  });

  /* --------------------------------------------------------------------------
   * Blocking
   * ------------------------------------------------------------------------ */

  describe("blocking", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = createContact();
    });

    it("starts unblocked", () => {
      expect(contact.isBlocked()).toBe(false);
    });

    it("respects an initially blocked contact", () => {
      const blocked = createContact({
        blocked: true,
      });

      expect(blocked.isBlocked()).toBe(true);
    });

    it("sets blocked=true", () => {
      const result = contact.setBlocked(true);

      expect(result).toBe(contact);
      expect(contact.isBlocked()).toBe(true);
    });

    it("sets blocked=false", () => {
      contact.setBlocked(true);

      const result = contact.setBlocked(false);

      expect(result).toBe(contact);
      expect(contact.isBlocked()).toBe(false);
    });

    it.each([null, undefined, "", "true", 1, 0, {}, []])(
      "rejects non-boolean blocked values: %s",
      (value) => {
        expectContactError(() => {
          contact.setBlocked(value as any);
        }, "Blocked must be boolean");
      },
    );

    it("block() changes an unblocked contact to blocked", () => {
      const result = contact.block();

      expect(result).toBe(contact);
      expect(contact.isBlocked()).toBe(true);
    });

    it("unblock() changes a blocked contact to unblocked", () => {
      contact.block();

      const result = contact.unblock();

      expect(result).toBe(contact);
      expect(contact.isBlocked()).toBe(false);
    });

    it("block() is idempotent", () => {
      contact.block();

      const timestamp = contact.meta.updatedAt;

      advanceTime("2026-01-01T00:01:00.000Z");

      contact.block();

      expect(contact.isBlocked()).toBe(true);
      expect(contact.meta.updatedAt).toBe(timestamp);
    });

    it("unblock() is idempotent", () => {
      const timestamp = contact.meta.updatedAt;

      advanceTime("2026-01-01T00:01:00.000Z");

      contact.unblock();

      expect(contact.isBlocked()).toBe(false);
      expect(contact.meta.updatedAt).toBe(timestamp);
    });

    it("updates timestamp only when a block state actually changes", () => {
      advanceTime("2026-01-01T00:01:00.000Z");

      contact.block();

      expect(contact.meta.updatedAt).toBe("2026-01-01T00:01:00.000Z");

      const blockedTimestamp = contact.meta.updatedAt;

      advanceTime("2026-01-01T00:02:00.000Z");

      contact.block();

      expect(contact.meta.updatedAt).toBe(blockedTimestamp);

      advanceTime("2026-01-01T00:03:00.000Z");

      contact.unblock();

      expect(contact.meta.updatedAt).toBe("2026-01-01T00:03:00.000Z");
    });

    it("static isBlocked() matches the instance state", () => {
      expect(MajikContact.isBlocked(contact)).toBe(false);

      contact.block();

      expect(MajikContact.isBlocked(contact)).toBe(true);

      contact.unblock();

      expect(MajikContact.isBlocked(contact)).toBe(false);
    });
  });

  /* --------------------------------------------------------------------------
   * Majikah Registration Status
   * ------------------------------------------------------------------------ */

  describe("Majikah registration status", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = createContact();
    });

    it("starts unchecked", () => {
      expect(contact.isMajikahIdentityChecked()).toBe(false);

      expect(contact.isMajikahRegistered()).toBe(false);
    });

    it("reports registered when set to true", () => {
      const result = contact.setMajikahStatus(true);

      expect(result).toBe(contact);
      expect(contact.isMajikahIdentityChecked()).toBe(true);

      expect(contact.isMajikahRegistered()).toBe(true);
    });

    it("distinguishes checked=false from unchecked", () => {
      contact.setMajikahStatus(false);

      expect(contact.isMajikahIdentityChecked()).toBe(true);

      expect(contact.isMajikahRegistered()).toBe(false);
    });

    it("supports registered -> unregistered transitions", () => {
      contact.setMajikahStatus(true);
      expect(contact.isMajikahRegistered()).toBe(true);

      contact.setMajikahStatus(false);

      expect(contact.isMajikahIdentityChecked()).toBe(true);

      expect(contact.isMajikahRegistered()).toBe(false);
    });

    it("preserves explicitly supplied true status", () => {
      const contactWithStatus = createContact(undefined, {
        majikah_registered: true,
      });

      expect(contactWithStatus.isMajikahIdentityChecked()).toBe(true);

      expect(contactWithStatus.isMajikahRegistered()).toBe(true);
    });

    it("preserves explicitly supplied false status", () => {
      const contactWithStatus = createContact(undefined, {
        majikah_registered: false,
      });

      expect(contactWithStatus.isMajikahIdentityChecked()).toBe(true);

      expect(contactWithStatus.isMajikahRegistered()).toBe(false);
    });
  });

  /* --------------------------------------------------------------------------
   * Address / Display Name
   * ------------------------------------------------------------------------ */

  describe("address and display name", () => {
    it("returns the address from the real X25519 key", async () => {
      const contact = createContact();

      const address = await contact.getAddress();

      expect(address).toBe(expectedBase64(contact.publicKey.raw));
    });

    it("uses the label as the display name", async () => {
      const contact = createContact({
        label: "Alice",
      });

      await expect(contact.getDisplayName()).resolves.toBe("Alice");
    });

    it("falls back to the address when label is empty", async () => {
      const contact = createContact({
        label: "",
      });

      await expect(contact.getDisplayName()).resolves.toBe(
        expectedBase64(contact.publicKey.raw),
      );
    });

    it("falls back to the address when label is undefined", async () => {
      const contact = createContact();

      contact.meta.label = undefined;

      await expect(contact.getDisplayName()).resolves.toBe(
        expectedBase64(contact.publicKey.raw),
      );
    });

    it("propagates getAddress() failures for a type-only legacy public-key shape", async () => {
      const contact = new MajikContact({
        id: contactA.id,
        publicKey: {
          type: "public",
        } as any,
        fingerprint: contactA.fingerprint,
        mlKey: contactA.mlKey,
      });

      await expect(contact.getAddress()).rejects.toThrow();
    });

    it("propagates the same failure through getDisplayName()", async () => {
      const contact = new MajikContact({
        id: contactA.id,
        publicKey: {
          type: "public",
        } as any,
        fingerprint: contactA.fingerprint,
        mlKey: contactA.mlKey,
      });

      await expect(contact.getDisplayName()).rejects.toThrow();
    });
  });

  /* --------------------------------------------------------------------------
   * Contact Card
   * ------------------------------------------------------------------------ */

  describe("toContactCard()", () => {
    it("creates a complete contact card", async () => {
      const contact = createContact(
        {
          label: "Alice",
        },
        {
          edPublicKeyBase64: "ed-test",
          mlDsaPublicKeyBase64: "mldsa-test",
        },
      );

      const card = await contact.toContactCard();

      expect(card).toEqual({
        id: contact.id,
        publicKey: expectedBase64(contact.publicKey.raw),
        fingerprint: contact.fingerprint,
        label: "Alice",
        mlKey: contact.mlKey,
        edPublicKeyBase64: "ed-test",
        mlDsaPublicKeyBase64: "mldsa-test",
      });
    });

    it("uses an empty label when no label is supplied", async () => {
      const card = await createContact().toContactCard();

      expect(card.label).toBe("");
    });

    it("includes empty strings for omitted public signing keys", async () => {
      const contact = new MajikContact({
        id: contactA.id,
        publicKey: contactA.publicKey,
        fingerprint: contactA.fingerprint,
        mlKey: contactA.mlKey,
      });

      const card = await contact.toContactCard();

      expect(card.edPublicKeyBase64).toBe("");
      expect(card.mlDsaPublicKeyBase64).toBe("");
    });

    it("does not include contact notes or blocking state", async () => {
      const contact = createContact({
        label: "Alice",
        notes: "Private notes",
        blocked: true,
      });

      const card = await contact.toContactCard();

      expect(card).not.toHaveProperty("notes");
      expect(card).not.toHaveProperty("blocked");
      expect(card).not.toHaveProperty("createdAt");
      expect(card).not.toHaveProperty("updatedAt");
    });

    it("fails when raw public-key bytes are unavailable", async () => {
      const contact = new MajikContact({
        id: contactA.id,
        publicKey: {
          type: "public",
        } as any,
        fingerprint: contactA.fingerprint,
        mlKey: contactA.mlKey,
      });

      await expect(contact.toContactCard()).rejects.toThrow();
    });
  });

  /* --------------------------------------------------------------------------
   * JSON Serialization
   * ------------------------------------------------------------------------ */

  describe("JSON serialization", () => {
    it("serializes the complete contact", async () => {
      const contact = createContact(
        {
          label: "Alice",
          notes: "Test",
          blocked: true,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
        {
          majikah_registered: true,
          edPublicKeyBase64: "ed-test",
          mlDsaPublicKeyBase64: "mldsa-test",
        },
      );

      const json = await contact.toJSON();

      expect(json).toEqual({
        id: contact.id,
        fingerprint: contact.fingerprint,
        meta: {
          label: "Alice",
          notes: "Test",
          blocked: true,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
        publicKeyBase64: expectedBase64(contact.publicKey.raw),
        majikah_registered: true,
        mlKey: contact.mlKey,
        edPublicKeyBase64: "ed-test",
        mlDsaPublicKeyBase64: "mldsa-test",
      });
    });

    it("serializes unchecked Majikah status as undefined", async () => {
      const json = await createContact().toJSON();

      expect(json.majikah_registered).toBeUndefined();
    });

    it("serializes false Majikah status", async () => {
      const json = await createContact(undefined, {
        majikah_registered: false,
      }).toJSON();

      expect(json.majikah_registered).toBe(false);
    });

    it("returns a metadata copy", async () => {
      const contact = createContact({
        label: "Alice",
      });

      const json = await contact.toJSON();

      expect(json.meta).not.toBe(contact.meta);

      json.meta!.label = "Modified";

      expect(contact.meta.label).toBe("Alice");
    });

    it("round-trips a complete contact", async () => {
      const original = createContact(
        {
          label: "Alice",
          notes: "Round trip",
          blocked: true,
        },
        {
          majikah_registered: true,
          edPublicKeyBase64: "ed-test",
          mlDsaPublicKeyBase64: "mldsa-test",
        },
      );

      const serialized = await original.toJSON();

      const restored = MajikContact.fromJSON(serialized);

      expect(restored).toBeInstanceOf(MajikContact);
      expect(restored.id).toBe(original.id);
      expect(restored.fingerprint).toBe(original.fingerprint);
      expect(restored.mlKey).toBe(original.mlKey);
      expect(restored.publicKey.raw).toEqual(original.publicKey.raw);

      expect(restored.meta).toEqual(original.meta);

      expect(restored.edPublicKeyBase64).toBe(original.edPublicKeyBase64);

      expect(restored.mlDsaPublicKeyBase64).toBe(original.mlDsaPublicKeyBase64);

      expect(restored.isMajikahIdentityChecked()).toBe(true);

      expect(restored.isMajikahRegistered()).toBe(true);
    });

    it("round-trips an explicitly false Majikah status", () => {
      const original = createContact(undefined, {
        majikah_registered: false,
      });

      const restored = MajikContact.fromJSON({
        id: original.id,
        fingerprint: original.fingerprint,
        meta: original.meta,
        publicKeyBase64: expectedBase64(original.publicKey.raw),
        majikah_registered: false,
        mlKey: original.mlKey,
        edPublicKeyBase64: original.edPublicKeyBase64,
        mlDsaPublicKeyBase64: original.mlDsaPublicKeyBase64,
      });

      expect(restored.isMajikahIdentityChecked()).toBe(true);

      expect(restored.isMajikahRegistered()).toBe(false);
    });

    it("restores default metadata when metadata is omitted", () => {
      const restored = MajikContact.fromJSON({
        id: contactA.id,
        fingerprint: contactA.fingerprint,
        publicKeyBase64: expectedBase64(contactA.publicKey.raw),
        mlKey: contactA.mlKey,
      });

      expect(restored.meta.label).toBe("");
      expect(restored.meta.notes).toBe("");
      expect(restored.meta.blocked).toBe(false);
      expect(restored.meta.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(restored.meta.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("wraps deserialization failures", () => {
      expectContactError(() => {
        MajikContact.fromJSON({
          id: contactA.id,
          fingerprint: contactA.fingerprint,
          publicKeyBase64: "%%% definitely invalid %%%",
          mlKey: contactA.mlKey,
        } as any);
      }, "Failed to deserialize MajikContact");
    });

    it("wraps constructor validation errors from invalid serialized data", () => {
      expectContactError(() => {
        MajikContact.fromJSON({
          id: "",
          fingerprint: contactA.fingerprint,
          publicKeyBase64: expectedBase64(contactA.publicKey.raw),
          mlKey: contactA.mlKey,
        } as any);
      }, "Failed to deserialize MajikContact");
    });

    it("fails when serialized public-key data is missing", () => {
      expectContactError(() => {
        MajikContact.fromJSON({
          id: contactA.id,
          fingerprint: contactA.fingerprint,
          mlKey: contactA.mlKey,
        } as any);
      }, "Failed to deserialize MajikContact");
    });
  });

  /* --------------------------------------------------------------------------
   * Majik Message Identity Import
   * ------------------------------------------------------------------------ */

  describe("fromIdentityJSON()", () => {
    function createIdentity(
      overrides: Partial<MajikMessageIdentityJSON> = {},
    ): MajikMessageIdentityJSON {
      return {
        id: "identity-001",
        user_id: "user-001",
        public_key: expectedBase64(contactA.publicKey.raw),
        ml_key: contactA.mlKey,
        phash: "identity-phash",
        label: "Remote User",
        timestamp: "2026-01-05T12:00:00.000Z",
        restricted: false,
        ...overrides,
      };
    }

    it("creates a contact from a valid message identity", async () => {
      const contact = await MajikContact.fromIdentityJSON(createIdentity());

      expect(contact).toBeInstanceOf(MajikContact);
      expect(contact.id).toBe("identity-001");
      expect(contact.mlKey).toBe(contactA.mlKey);
      expect(contact.fingerprint).toBe("identity-001");

      expect(contact.meta.label).toBe("Remote User");
      expect(contact.meta.blocked).toBe(false);
      expect(contact.meta.createdAt).toBe("2026-01-05T12:00:00.000Z");
      expect(contact.meta.updatedAt).toBe("2026-01-05T12:00:00.000Z");

      expect(contact.isMajikahIdentityChecked()).toBe(true);

      expect(contact.isMajikahRegistered()).toBe(true);
    });

    it("decodes the public key correctly", async () => {
      const contact = await MajikContact.fromIdentityJSON(createIdentity());

      expect(contact.publicKey.raw).toEqual(contactA.publicKey.raw);
    });

    it("maps restricted=true to blocked=true", async () => {
      const contact = await MajikContact.fromIdentityJSON(
        createIdentity({
          restricted: true,
        }),
      );

      expect(contact.isBlocked()).toBe(true);
    });

    it("maps restricted=false to blocked=false", async () => {
      const contact = await MajikContact.fromIdentityJSON(
        createIdentity({
          restricted: false,
        }),
      );

      expect(contact.isBlocked()).toBe(false);
    });

    it("uses id as the fingerprint rather than phash", async () => {
      const contact = await MajikContact.fromIdentityJSON(
        createIdentity({
          id: "derived-id",
          phash: "completely-different",
        }),
      );

      expect(contact.fingerprint).toBe("derived-id");

      expect(contact.fingerprint).not.toBe("completely-different");
    });

    it("wraps malformed public-key conversion errors", async () => {
      await expect(
        MajikContact.fromIdentityJSON(
          createIdentity({
            public_key: "%%% definitely invalid %%%",
          }),
        ),
      ).rejects.toThrow(MajikContactError);

      await expect(
        MajikContact.fromIdentityJSON(
          createIdentity({
            public_key: "%%% definitely invalid %%%",
          }),
        ),
      ).rejects.toThrow(
        "Failed to create MajikContact from MajikMessageIdentityJSON",
      );
    });

    it("wraps constructor validation failures", async () => {
      await expect(
        MajikContact.fromIdentityJSON(
          createIdentity({
            id: "",
          }),
        ),
      ).rejects.toThrow(
        "Failed to create MajikContact from MajikMessageIdentityJSON",
      );
    });
  });

  /* --------------------------------------------------------------------------
   * Fluent API / Frozen Prototype
   * ------------------------------------------------------------------------ */

  describe("API surface", () => {
    it("returns the same instance from mutation methods", () => {
      const contact = createContact();

      expect(
        contact.updateMeta({
          label: "A",
        }),
      ).toBe(contact);

      expect(contact.updateLabel("B")).toBe(contact);

      expect(contact.updateNotes("C")).toBe(contact);

      expect(contact.setBlocked(true)).toBe(contact);

      expect(contact.block()).toBe(contact);

      expect(contact.unblock()).toBe(contact);

      expect(contact.setMajikahStatus(true)).toBe(contact);
    });

    it("keeps instance state mutable", () => {
      const contact = createContact();

      expect(Object.isFrozen(contact)).toBe(false);
      expect(Object.isFrozen(contact.meta)).toBe(false);
    });

    it("freezes the constructor", () => {
      expect(Object.isFrozen(MajikContact)).toBe(true);
    });

    it("freezes the instance prototype", () => {
      expect(Object.isFrozen(MajikContact.prototype)).toBe(true);
    });
  });
});

/* ============================================================================
 * MAJIK CONTACT GROUP
 * ========================================================================== */

describe("MajikContactGroup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    advanceTime("2026-02-01T00:00:00.000Z");
  });

  /* --------------------------------------------------------------------------
   * Construction and Defaults
   * ------------------------------------------------------------------------ */

  describe("construction and defaults", () => {
    it("creates a standard custom group", () => {
      const group = createGroup();

      expect(group).toBeInstanceOf(MajikContactGroup);

      expect(group.id).toBe("group-001");
      expect(group.isSystem).toBe(false);

      expect(group.meta.name).toBe("Test Group");

      expect(group.meta.description).toBe("");
      expect(group.meta.photoBase64).toBeNull();
      expect(group.meta.color).toBeUndefined();

      expect(group.meta.createdAt).toBe("2026-02-01T00:00:00.000Z");

      expect(group.meta.updatedAt).toBe("2026-02-01T00:00:00.000Z");

      expect(group.listMemberIds()).toEqual([]);
      expect(group.memberCount()).toBe(0);
      expect(group.isEmpty()).toBe(true);
    });

    it("applies supplied metadata", () => {
      const group = createGroup(
        "group-002",
        "Engineering",
        {
          description: "Engineering team",
          photoBase64: "data:image/png;base64,AAA=",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
          color: "#002968",
        },
        [contactA.id, contactB.id],
      );

      expect(group.meta).toEqual({
        name: "Engineering",
        description: "Engineering team",
        photoBase64: "data:image/png;base64,AAA=",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        color: "#002968",
      });

      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });

    it("defaults isSystem to false", () => {
      const group = new MajikContactGroup({
        id: "custom",
        meta: {
          name: "Custom",
        },
      });

      expect(group.isSystem).toBe(false);
    });

    it("defaults memberIds to an empty set", () => {
      const group = new MajikContactGroup({
        id: "custom",
        meta: {
          name: "Custom",
        },
      });

      expect(group.listMemberIds()).toEqual([]);
    });

    it("creates custom groups through static create()", () => {
      const group = MajikContactGroup.create(
        "engineering",
        "Engineering",
        {
          description: "Engineering contacts",
        },
        [contactA.id],
      );

      expect(group.id).toBe("engineering");

      expect(group.meta.name).toBe("Engineering");

      expect(group.meta.description).toBe("Engineering contacts");

      expect(group.listMemberIds()).toEqual([contactA.id]);

      expect(group.isSystem).toBe(false);
    });
  });

  /* --------------------------------------------------------------------------
   * Construction Validation
   * ------------------------------------------------------------------------ */

  describe("construction validation", () => {
    it("rejects empty group IDs", () => {
      expectGroupError(
        () => createGroup("", "Valid"),
        "Group ID must be a non-empty string",
      );
    });

    it("rejects whitespace-only group IDs", () => {
      expectGroupError(
        () => createGroup("   ", "Valid"),
        "Group ID must be a non-empty string",
      );
    });

    it.each([
      ["empty", ""],
      ["whitespace", "   "],
      ["null", null],
      ["undefined", undefined],
      ["number", 42],
      ["boolean", false],
      ["object", {}],
      ["array", []],
    ])("rejects invalid custom names: %s", (_label, name) => {
      expectGroupError(() => {
        new MajikContactGroup({
          id: "group",
          meta: {
            name: name as any,
          },
          isSystem: false,
        });
      }, "Group name must be a non-empty string");
    });

    it("rejects names longer than 64 characters", () => {
      expectGroupError(
        () => createGroup("group", "A".repeat(65)),
        "Group name must not exceed 64 characters",
      );
    });

    it("accepts names exactly 64 characters long", () => {
      const name = "A".repeat(64);

      const group = createGroup("group", name);

      expect(group.meta.name).toBe(name);
    });

    it("rejects reserved Favorites names case-insensitively", () => {
      const reserved = SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES];

      expectGroupError(
        () => createGroup("a", reserved),
        /reserved system group name/,
      );

      expectGroupError(
        () => createGroup("b", reserved.toUpperCase()),
        /reserved system group name/,
      );
    });

    it("rejects reserved Blocked names case-insensitively", () => {
      const reserved = SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED];

      expectGroupError(
        () => createGroup("a", reserved),
        /reserved system group name/,
      );

      expectGroupError(
        () => createGroup("b", reserved.toUpperCase()),
        /reserved system group name/,
      );
    });

    it("rejects duplicate member IDs", () => {
      expectGroupError(
        () =>
          createGroup("group", "Group", {}, [
            contactA.id,
            contactB.id,
            contactA.id,
          ]),
        "Member IDs must not contain duplicates",
      );
    });

    it("rejects empty member IDs", () => {
      expectGroupError(
        () => createGroup("group", "Group", {}, [contactA.id, ""]),
        /Invalid member ID at index 1/,
      );
    });

    it("rejects whitespace member IDs", () => {
      expectGroupError(
        () => createGroup("group", "Group", {}, [contactA.id, "   "]),
        /Invalid member ID at index 1/,
      );
    });

    it("rejects non-string member IDs", () => {
      expectGroupError(
        () => createGroup("group", "Group", {}, [contactA.id, 123 as any]),
        /Invalid member ID at index 1/,
      );
    });

    it("rejects a non-array memberIds value", () => {
      expectGroupError(() => {
        new MajikContactGroup({
          id: "group",
          meta: {
            name: "Group",
          },
          memberIds: "not-an-array" as any,
        });
      }, "Member IDs must be an array");
    });
  });

  /* --------------------------------------------------------------------------
   * System Groups
   * ------------------------------------------------------------------------ */

  describe("system groups", () => {
    it("creates Favorites correctly", () => {
      const favorites = MajikContactGroup.createFavorites();

      expect(favorites.isSystem).toBe(true);
      expect(favorites.isFavorites()).toBe(true);
      expect(favorites.isBlocked()).toBe(false);

      expect(favorites.id).toBe(SYSTEM_GROUP_IDS.FAVORITES);

      expect(favorites.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );
    });

    it("creates Blocked correctly", () => {
      const blocked = MajikContactGroup.createBlocked();

      expect(blocked.isSystem).toBe(true);
      expect(blocked.isBlocked()).toBe(true);
      expect(blocked.isFavorites()).toBe(false);

      expect(blocked.id).toBe(SYSTEM_GROUP_IDS.BLOCKED);

      expect(blocked.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED],
      );
    });

    it("forces canonical Favorites names", () => {
      const favorites = new MajikContactGroup({
        id: SYSTEM_GROUP_IDS.FAVORITES,
        isSystem: true,
        meta: {
          name: "Forged Favorites",
        },
      });

      expect(favorites.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );
    });

    it("forces canonical Blocked names", () => {
      const blocked = new MajikContactGroup({
        id: SYSTEM_GROUP_IDS.BLOCKED,
        isSystem: true,
        meta: {
          name: "Forged Blocked",
        },
      });

      expect(blocked.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED],
      );
    });

    it("does not require metadata for recognized system groups", () => {
      expect(() => {
        new MajikContactGroup({
          id: SYSTEM_GROUP_IDS.FAVORITES,
          isSystem: true,
        });
      }).not.toThrow();
    });

    it("does not apply custom name validation to unknown system IDs", () => {
      const group = new MajikContactGroup({
        id: "unknown-system-id",
        isSystem: true,
        meta: {
          name: "",
        },
      });

      expect(group.isSystem).toBe(true);
      expect(group.meta.name).toBe("");
    });

    it("prevents system-group renaming", () => {
      const favorites = MajikContactGroup.createFavorites();

      expectGroupError(
        () => favorites.updateName("Renamed Favorites"),
        /cannot be renamed/,
      );
    });

    it("allows metadata updates other than name on system groups", () => {
      const favorites = MajikContactGroup.createFavorites();

      favorites.updateDescription("System group");

      favorites.setColor("#002968");

      expect(favorites.meta.description).toBe("System group");

      expect(favorites.meta.color).toBe("#002968");
    });

    it("allows membership mutations on system groups", () => {
      const blocked = MajikContactGroup.createBlocked();

      blocked.addMember(contactA.id);

      expect(blocked.hasMember(contactA.id)).toBe(true);
    });
  });

  /* --------------------------------------------------------------------------
   * Metadata Mutation
   * ------------------------------------------------------------------------ */

  describe("metadata mutation", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = createGroup();
    });

    it("updates name and returns this", () => {
      const result = group.updateName("Engineering");

      expect(result).toBe(group);
      expect(group.meta.name).toBe("Engineering");
    });

    it("trims name", () => {
      group.updateName("  Engineering  ");

      expect(group.meta.name).toBe("Engineering");
    });

    it("rejects an empty name", () => {
      expectGroupError(
        () => group.updateName(""),
        "Group name must be a non-empty string",
      );
    });

    it("rejects a whitespace-only name", () => {
      expectGroupError(
        () => group.updateName("   "),
        "Group name must be a non-empty string",
      );
    });

    it("rejects names longer than 64 characters", () => {
      expectGroupError(
        () => group.updateName("A".repeat(65)),
        "Group name must not exceed 64 characters",
      );
    });

    it("rejects reserved names", () => {
      const blockedName = SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED];

      expectGroupError(
        () => group.updateName(blockedName),
        /reserved system group name/,
      );
    });

    it("updates and trims description", () => {
      const result = group.updateDescription("  Team description  ");

      expect(result).toBe(group);
      expect(group.meta.description).toBe("Team description");
    });

    it("allows an empty description", () => {
      group.updateDescription("Test");
      group.updateDescription("");

      expect(group.meta.description).toBe("");
    });

    it.each([null, undefined, 123, false, {}, []])(
      "rejects non-string descriptions: %s",
      (value) => {
        expectGroupError(
          () => group.updateDescription(value as any),
          "Description must be a string",
        );
      },
    );

    it("sets and trims color", () => {
      const result = group.setColor("  #002968  ");

      expect(result).toBe(group);
      expect(group.meta.color).toBe("#002968");
    });

    it("clears color using setColor(undefined)", () => {
      group.setColor("#002968");

      group.setColor(undefined);

      expect(group.meta.color).toBeUndefined();
    });

    it("clears color using clearColor()", () => {
      group.setColor("#002968");

      const result = group.clearColor();

      expect(result).toBe(group);
      expect(group.meta.color).toBeUndefined();
    });

    it("updates timestamp on metadata changes", () => {
      advanceTime("2026-02-01T00:01:00.000Z");

      group.updateName("Engineering");

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");

      advanceTime("2026-02-01T00:02:00.000Z");

      group.updateDescription("Description");

      expect(group.meta.updatedAt).toBe("2026-02-01T00:02:00.000Z");

      advanceTime("2026-02-01T00:03:00.000Z");

      group.setColor("#123456");

      expect(group.meta.updatedAt).toBe("2026-02-01T00:03:00.000Z");
    });

    it("preserves createdAt during mutation", () => {
      const createdAt = group.meta.createdAt;

      advanceTime("2026-02-01T01:00:00.000Z");

      group.updateDescription("Changed");

      expect(group.meta.createdAt).toBe(createdAt);

      expect(group.meta.updatedAt).toBe("2026-02-01T01:00:00.000Z");
    });
  });

  /* --------------------------------------------------------------------------
   * Photo Management
   * ------------------------------------------------------------------------ */

  describe("photo management", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = createGroup();
    });

    it("starts without a photo", () => {
      expect(group.meta.photoBase64).toBeNull();

      expect(group.hasPhoto()).toBe(false);
    });

    it("accepts a Base64 string and normalizes it", async () => {
      const rawBase64 = "aW1hZ2VkYXRh";

      await group.setPhoto(rawBase64);

      expect(group.meta.photoBase64).toBe(
        `data:image/jpeg;base64,${rawBase64}`,
      );

      expect(group.hasPhoto()).toBe(true);
    });

    it("accepts a data URL", async () => {
      const dataUrl = "data:image/png;base64,aW1hZ2VkYXRh";

      await group.setPhoto(dataUrl);

      expect(group.meta.photoBase64).toBe(dataUrl);

      expect(group.hasPhoto()).toBe(true);
    });

    it("accepts Uint8Array input", async () => {
      await group.setPhoto(Uint8Array.from([1, 2, 3, 4]));

      expect(group.meta.photoBase64).toMatch(/^data:/);

      expect(group.hasPhoto()).toBe(true);
    });

    it("accepts ArrayBuffer input", async () => {
      const bytes = Uint8Array.from([1, 2, 3, 4]);

      await group.setPhoto(bytes.buffer);

      expect(group.meta.photoBase64).toMatch(/^data:/);

      expect(group.hasPhoto()).toBe(true);
    });

    it("returns the same group instance", async () => {
      const result = await group.setPhoto("aW1hZ2VkYXRh");

      expect(result).toBe(group);
    });

    it("updates timestamp after setting a photo", async () => {
      advanceTime("2026-02-01T00:01:00.000Z");

      await group.setPhoto("aW1hZ2VkYXRh");

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("rejects null input", async () => {
      const timestamp = group.meta.updatedAt;

      await expect(group.setPhoto(null)).rejects.toThrow(
        MajikContactGroupError,
      );

      expect(group.meta.updatedAt).toBe(timestamp);

      expect(group.meta.photoBase64).toBeNull();
    });

    it("rejects undefined input", async () => {
      const timestamp = group.meta.updatedAt;

      await expect(group.setPhoto(undefined)).rejects.toThrow(
        MajikContactGroupError,
      );

      expect(group.meta.updatedAt).toBe(timestamp);

      expect(group.meta.photoBase64).toBeNull();
    });

    it("wraps unsupported photo input failures", async () => {
      await expect(
        group.setPhoto({
          unsupported: true,
        }),
      ).rejects.toThrow(MajikContactGroupError);
    });

    it("does not replace an existing photo when setPhoto() fails", async () => {
      await group.setPhoto("aW1hZ2VkYXRh");

      const original = group.meta.photoBase64;

      await expect(
        group.setPhoto({
          unsupported: true,
        }),
      ).rejects.toThrow();

      expect(group.meta.photoBase64).toBe(original);
    });

    it("clears a photo", async () => {
      await group.setPhoto("aW1hZ2VkYXRh");

      advanceTime("2026-02-01T00:02:00.000Z");

      const result = group.clearPhoto();

      expect(result).toBe(group);
      expect(group.meta.photoBase64).toBeNull();

      expect(group.hasPhoto()).toBe(false);

      expect(group.meta.updatedAt).toBe("2026-02-01T00:02:00.000Z");
    });

    it("returns false for an empty photo string", () => {
      group.meta.photoBase64 = "";

      expect(group.hasPhoto()).toBe(false);
    });

    it("returns true for a non-empty photo string", () => {
      group.meta.photoBase64 = "data:image/png;base64,AAA=";

      expect(group.hasPhoto()).toBe(true);
    });
  });

  /* --------------------------------------------------------------------------
   * Membership Management
   * ------------------------------------------------------------------------ */

  describe("membership management", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = createGroup();
    });

    it("adds a real MajikContact ID", () => {
      const result = group.addMember(contactA.id);

      expect(result).toBe(group);
      expect(group.hasMember(contactA.id)).toBe(true);

      expect(group.memberCount()).toBe(1);

      expect(group.isEmpty()).toBe(false);
    });

    it("adds multiple real contact IDs", () => {
      group.addMembers([contactA.id, contactB.id, contactC.id]);

      expect(group.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);

      expect(group.memberCount()).toBe(3);
    });

    it("preserves insertion order", () => {
      group.addMember(contactB.id);
      group.addMember(contactA.id);
      group.addMember(contactC.id);

      expect(group.listMemberIds()).toEqual([
        contactB.id,
        contactA.id,
        contactC.id,
      ]);
    });

    it("rejects duplicate addMember()", () => {
      group.addMember(contactA.id);

      expectGroupError(() => group.addMember(contactA.id), /already a member/);

      expect(group.listMemberIds()).toEqual([contactA.id]);
    });

    it("supports idempotent addMemberIfAbsent()", () => {
      group.addMemberIfAbsent(contactA.id);

      group.addMemberIfAbsent(contactA.id);

      expect(group.listMemberIds()).toEqual([contactA.id]);

      expect(group.memberCount()).toBe(1);
    });

    it("does not update timestamp for an idempotent add no-op", () => {
      group.addMemberIfAbsent(contactA.id);

      const timestamp = group.meta.updatedAt;

      advanceTime("2026-02-01T00:01:00.000Z");

      group.addMemberIfAbsent(contactA.id);

      expect(group.meta.updatedAt).toBe(timestamp);
    });

    it("updates timestamp when addMemberIfAbsent actually adds", () => {
      advanceTime("2026-02-01T00:01:00.000Z");

      group.addMemberIfAbsent(contactA.id);

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("accepts an empty addMembers array", () => {
      expect(() => group.addMembers([])).not.toThrow();
    });

    it("rejects duplicates inside addMembers input", () => {
      expectGroupError(
        () => group.addMembers([contactA.id, contactA.id]),
        "Member IDs must not contain duplicates",
      );

      expect(group.isEmpty()).toBe(true);
    });

    it("rejects existing members in addMembers", () => {
      group.addMember(contactA.id);

      expectGroupError(
        () => group.addMembers([contactA.id, contactB.id]),
        /already members/,
      );

      /*
       * Validation happens before the insertion loop, so contactB must not
       * have been added after the error.
       */
      expect(group.listMemberIds()).toEqual([contactA.id]);
    });

    it("rejects non-array addMembers input", () => {
      expectGroupError(
        () => group.addMembers(null as any),
        "Member IDs must be an array",
      );
    });

    it("removes an existing member", () => {
      group.addMember(contactA.id);

      const result = group.removeMember(contactA.id);

      expect(result).toBe(group);
      expect(group.hasMember(contactA.id)).toBe(false);

      expect(group.memberCount()).toBe(0);

      expect(group.isEmpty()).toBe(true);
    });

    it("rejects removing a missing member", () => {
      expectGroupError(
        () => group.removeMember(contactA.id),
        /is not a member of group/,
      );
    });

    it("supports idempotent removeMemberIfPresent()", () => {
      group.addMember(contactA.id);

      group.removeMemberIfPresent(contactA.id);

      group.removeMemberIfPresent(contactA.id);

      expect(group.isEmpty()).toBe(true);
    });

    it("does not update timestamp for an idempotent remove no-op", () => {
      const timestamp = group.meta.updatedAt;

      advanceTime("2026-02-01T00:01:00.000Z");

      group.removeMemberIfPresent(contactA.id);

      expect(group.meta.updatedAt).toBe(timestamp);
    });

    it("updates timestamp when removeMemberIfPresent actually removes", () => {
      group.addMember(contactA.id);

      advanceTime("2026-02-01T00:01:00.000Z");

      group.removeMemberIfPresent(contactA.id);

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it.each([
      ["empty", ""],
      ["whitespace", "   "],
      ["null", null],
      ["undefined", undefined],
      ["number", 123],
      ["boolean", false],
      ["object", {}],
      ["array", []],
    ])(
      "rejects invalid contact IDs in membership operations: %s",
      (_label, value) => {
        expectGroupError(
          () => group.addMember(value as any),
          "Contact ID must be a non-empty string",
        );

        expectGroupError(
          () => group.addMemberIfAbsent(value as any),
          "Contact ID must be a non-empty string",
        );

        expectGroupError(
          () => group.removeMember(value as any),
          "Contact ID must be a non-empty string",
        );

        expectGroupError(
          () => group.removeMemberIfPresent(value as any),
          "Contact ID must be a non-empty string",
        );

        expectGroupError(
          () => group.hasMember(value as any),
          "Contact ID must be a non-empty string",
        );
      },
    );

    it("returns a defensive copy from listMemberIds()", () => {
      group.addMembers([contactA.id, contactB.id]);

      const ids = group.listMemberIds();

      ids.push(contactC.id);
      ids.shift();

      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });

    it("clearMembers() removes all members", () => {
      group.addMembers([contactA.id, contactB.id, contactC.id]);

      const result = group.clearMembers();

      expect(result).toBe(group);
      expect(group.memberCount()).toBe(0);

      expect(group.listMemberIds()).toEqual([]);

      expect(group.isEmpty()).toBe(true);
    });

    it("updates timestamp when clearMembers() is called", () => {
      group.addMember(contactA.id);

      advanceTime("2026-02-01T00:01:00.000Z");

      group.clearMembers();

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("also updates timestamp when clearing an already empty group", () => {
      const originalTimestamp = group.meta.updatedAt;

      advanceTime("2026-02-01T00:01:00.000Z");

      group.clearMembers();

      expect(group.meta.updatedAt).not.toBe(originalTimestamp);

      expect(group.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });
  });

  /* --------------------------------------------------------------------------
   * System Helpers
   * ------------------------------------------------------------------------ */

  describe("system helpers", () => {
    it("identifies Favorites correctly", () => {
      const favorites = MajikContactGroup.createFavorites();

      expect(favorites.isFavorites()).toBe(true);

      expect(favorites.isBlocked()).toBe(false);
    });

    it("identifies Blocked correctly", () => {
      const blocked = MajikContactGroup.createBlocked();

      expect(blocked.isBlocked()).toBe(true);

      expect(blocked.isFavorites()).toBe(false);
    });

    it("returns false on a custom group", () => {
      const group = createGroup();

      expect(group.isFavorites()).toBe(false);

      expect(group.isBlocked()).toBe(false);
    });
  });

  /* --------------------------------------------------------------------------
   * Static merge()
   * ------------------------------------------------------------------------ */

  describe("static merge()", () => {
    let groupAB: MajikContactGroup;
    let groupBC: MajikContactGroup;
    let groupCD: MajikContactGroup;

    beforeEach(() => {
      groupAB = createGroup(
        "group-ab",
        "Group AB",
        {
          description: "AB description",
          photoBase64: "data:image/png;base64,AAA=",
          color: "#111111",
        },
        [contactA.id, contactB.id],
      );

      groupBC = createGroup(
        "group-bc",
        "Group BC",
        {
          description: "BC description",
        },
        [contactB.id, contactC.id],
      );

      groupCD = createGroup(
        "group-cd",
        "Group CD",
        {
          description: "CD description",
        },
        [contactC.id, "contact-d"],
      );
    });

    it("requires an array", () => {
      expectGroupError(
        () => MajikContactGroup.merge(null as any),
        /expected an array of MajikContactGroup instances/,
      );
    });

    it("requires at least two groups", () => {
      expectGroupError(
        () => MajikContactGroup.merge([]),
        /requires at least two groups/,
      );

      expectGroupError(
        () => MajikContactGroup.merge([groupAB]),
        /requires at least two groups/,
      );
    });

    it("rejects non-group members", () => {
      expectGroupError(
        () => MajikContactGroup.merge([groupAB, {} as any]),
        /item at index 1 is not a MajikContactGroup instance/,
      );
    });

    it("creates the union of all members", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC, groupCD]);

      expect(merged.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
        "contact-d",
      ]);
    });

    it("silently eliminates duplicates", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      expect(merged.memberCount()).toBe(3);

      expect(merged.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);
    });

    it("defaults ID and name to the first group", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      expect(merged.id).toBe(groupAB.id);

      expect(merged.meta.name).toBe(groupAB.meta.name);
    });

    it("inherits description and photo from the first group", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      expect(merged.meta.description).toBe(groupAB.meta.description);

      expect(merged.meta.photoBase64).toBe(groupAB.meta.photoBase64);
    });

    it("does not inherit color", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      expect(merged.meta.color).toBeUndefined();
    });

    it("always creates a non-system group", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      expect(merged.isSystem).toBe(false);
    });

    it("supports ID overrides", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC], {
        id: "  merged-id  ",
      });

      expect(merged.id).toBe("merged-id");
    });

    it("supports name overrides", () => {
      const merged = MajikContactGroup.merge([groupAB, groupBC], {
        name: "  Merged Group  ",
      });

      expect(merged.meta.name).toBe("Merged Group");
    });

    it("rejects empty ID overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            id: "",
          }),
        /overrideId must be a non-empty string/,
      );
    });

    it("rejects whitespace ID overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            id: "   ",
          }),
        /overrideId must be a non-empty string/,
      );
    });

    it("rejects non-string ID overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            id: 123 as any,
          }),
        /overrideId must be a non-empty string/,
      );
    });

    it("rejects empty name overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            name: "",
          }),
        /overrideName must be a non-empty string/,
      );
    });

    it("rejects whitespace name overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            name: "   ",
          }),
        /overrideName must be a non-empty string/,
      );
    });

    it("rejects non-string name overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            name: 123 as any,
          }),
        /overrideName must be a non-empty string/,
      );
    });

    it("rejects names longer than 64 characters", () => {
      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            name: "A".repeat(65),
          }),
        /overrideName must not exceed 64 characters/,
      );
    });

    it("rejects reserved names", () => {
      const reserved = SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES];

      expectGroupError(
        () =>
          MajikContactGroup.merge([groupAB, groupBC], {
            name: reserved,
          }),
        /reserved system group name/,
      );
    });

    it("does not mutate the source groups", () => {
      const originalAB = groupAB.listMemberIds();

      const originalBC = groupBC.listMemberIds();

      const merged = MajikContactGroup.merge([groupAB, groupBC]);

      merged.addMember("new-contact");

      expect(groupAB.listMemberIds()).toEqual(originalAB);

      expect(groupBC.listMemberIds()).toEqual(originalBC);
    });

    it("returns an empty group when all source groups are empty", () => {
      const emptyA = createGroup("a", "A");

      const emptyB = createGroup("b", "B");

      const merged = MajikContactGroup.merge([emptyA, emptyB], {
        name: "Merged",
      });

      expect(merged.isEmpty()).toBe(true);
    });

    it("requires a valid custom name when the first source is Favorites", () => {
      const favorites = MajikContactGroup.createFavorites();

      favorites.addMember(contactA.id);

      expectGroupError(
        () => MajikContactGroup.merge([favorites, groupBC]),
        /reserved system group name/,
      );
    });

    it("can merge Favorites with an explicit non-reserved name", () => {
      const favorites = MajikContactGroup.createFavorites();

      favorites.addMember(contactA.id);

      const merged = MajikContactGroup.merge([favorites, groupBC], {
        name: "Favorites Snapshot",
      });

      expect(merged.isSystem).toBe(false);

      expect(merged.meta.name).toBe("Favorites Snapshot");

      expect(merged.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);
    });
  });

  /* --------------------------------------------------------------------------
   * Static intersect()
   * ------------------------------------------------------------------------ */

  describe("static intersect()", () => {
    let groupAB: MajikContactGroup;
    let groupBC: MajikContactGroup;
    let groupAC: MajikContactGroup;

    beforeEach(() => {
      groupAB = createGroup(
        "group-ab",
        "Group AB",
        {
          description: "AB description",
          photoBase64: "data:image/png;base64,AAA=",
          color: "#111111",
        },
        [contactA.id, contactB.id],
      );

      groupBC = createGroup("group-bc", "Group BC", {}, [
        contactB.id,
        contactC.id,
      ]);

      groupAC = createGroup("group-ac", "Group AC", {}, [
        contactA.id,
        contactC.id,
      ]);
    });

    it("requires an array", () => {
      expectGroupError(
        () => MajikContactGroup.intersect(null as any),
        /expected an array of MajikContactGroup instances/,
      );
    });

    it("requires at least two groups", () => {
      expectGroupError(
        () => MajikContactGroup.intersect([]),
        /requires at least two groups/,
      );

      expectGroupError(
        () => MajikContactGroup.intersect([groupAB]),
        /requires at least two groups/,
      );
    });

    it("rejects non-group items", () => {
      expectGroupError(
        () => MajikContactGroup.intersect([groupAB, null as any]),
        /item at index 1 is not a MajikContactGroup instance/,
      );
    });

    it("returns the common members of two groups", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      expect(result.listMemberIds()).toEqual([contactB.id]);
    });

    it("returns only members common to all groups", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC, groupAC]);

      expect(result.isEmpty()).toBe(true);

      expect(result.memberCount()).toBe(0);
    });

    it("preserves first-group member order", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
        contactC.id,
      ]);

      const second = createGroup("second", "Second", {}, [
        contactC.id,
        contactA.id,
        contactB.id,
      ]);

      const result = MajikContactGroup.intersect([first, second]);

      expect(result.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);
    });

    it("defaults ID and name to first group", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      expect(result.id).toBe(groupAB.id);

      expect(result.meta.name).toBe(groupAB.meta.name);
    });

    it("inherits description and photo from first group", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      expect(result.meta.description).toBe(groupAB.meta.description);

      expect(result.meta.photoBase64).toBe(groupAB.meta.photoBase64);
    });

    it("does not inherit color", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      expect(result.meta.color).toBeUndefined();
    });

    it("always creates a non-system group", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      expect(result.isSystem).toBe(false);
    });

    it("supports ID and name overrides", () => {
      const result = MajikContactGroup.intersect([groupAB, groupBC], {
        id: "  common-id  ",
        name: "  Shared  ",
      });

      expect(result.id).toBe("common-id");

      expect(result.meta.name).toBe("Shared");
    });

    it("returns an empty result when no members overlap", () => {
      const first = createGroup("first", "First", {}, ["first-member"]);

      const second = createGroup("second", "Second", {}, ["second-member"]);

      const result = MajikContactGroup.intersect([first, second]);

      expect(result.isEmpty()).toBe(true);
    });

    it("returns an empty result when every source group is empty", () => {
      const result = MajikContactGroup.intersect([
        createGroup("a", "A"),
        createGroup("b", "B"),
      ]);

      expect(result.isEmpty()).toBe(true);
    });

    it("does not mutate the source groups", () => {
      const original = groupAB.listMemberIds();

      const result = MajikContactGroup.intersect([groupAB, groupBC]);

      result.clearMembers();

      expect(groupAB.listMemberIds()).toEqual(original);
    });

    it("rejects non-string ID overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.intersect([groupAB, groupBC], { id: 123 as any }),
        /overrideId must be a non-empty string/,
      );
    });

    it("rejects non-string name overrides", () => {
      expectGroupError(
        () =>
          MajikContactGroup.intersect([groupAB, groupBC], { name: 123 as any }),
        /overrideName must be a non-empty string/,
      );
    });
  });

  /* --------------------------------------------------------------------------
   * Instance mergeWith()
   * ------------------------------------------------------------------------ */

  describe("mergeWith()", () => {
    it("mutates the current group", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
      ]);

      const second = createGroup("second", "Second", {}, [
        contactB.id,
        contactC.id,
      ]);

      const result = first.mergeWith(second);

      expect(result).toBe(first);

      expect(first.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);

      expect(second.listMemberIds()).toEqual([contactB.id, contactC.id]);
    });

    it("supports multiple groups", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      const third = createGroup("third", "Third", {}, [contactC.id]);

      first.mergeWith(second, third);

      expect(first.listMemberIds()).toEqual([
        contactA.id,
        contactB.id,
        contactC.id,
      ]);
    });

    it("silently ignores duplicates", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [
        contactA.id,
        contactB.id,
      ]);

      first.mergeWith(second);

      expect(first.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });

    it("requires at least one group", () => {
      expectGroupError(
        () => createGroup().mergeWith(),
        /requires at least one other group/,
      );
    });

    it("rejects invalid arguments", () => {
      expectGroupError(
        () => createGroup().mergeWith({} as any),
        /Argument at index 0 is not a MajikContactGroup instance/,
      );
    });

    it("updates timestamp", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      advanceTime("2026-02-01T00:01:00.000Z");

      first.mergeWith(second);

      expect(first.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("updates timestamp even when membership is unchanged", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [contactA.id]);

      advanceTime("2026-02-01T00:01:00.000Z");

      first.mergeWith(second);

      expect(first.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("mutates progressively before a later invalid argument throws", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      expectGroupError(
        () => first.mergeWith(second, {} as any),
        /Argument at index 1 is not a MajikContactGroup instance/,
      );

      expect(first.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });

    it("can merge a group with itself", () => {
      const group = createGroup("self", "Self", {}, [contactA.id, contactB.id]);

      group.mergeWith(group);

      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });
  });

  /* --------------------------------------------------------------------------
   * Instance intersectWith()
   * ------------------------------------------------------------------------ */

  describe("intersectWith()", () => {
    it("mutates the current group", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
      ]);

      const second = createGroup("second", "Second", {}, [
        contactB.id,
        contactC.id,
      ]);

      const result = first.intersectWith(second);

      expect(result).toBe(first);

      expect(first.listMemberIds()).toEqual([contactB.id]);
    });

    it("supports multiple groups", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
        contactC.id,
      ]);

      const second = createGroup("second", "Second", {}, [
        contactB.id,
        contactC.id,
      ]);

      const third = createGroup("third", "Third", {}, [contactB.id]);

      first.intersectWith(second, third);

      expect(first.listMemberIds()).toEqual([contactB.id]);
    });

    it("can reduce membership to empty", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      first.intersectWith(second);

      expect(first.isEmpty()).toBe(true);
    });

    it("requires at least one other group", () => {
      expectGroupError(
        () => createGroup().intersectWith(),
        /requires at least one other group/,
      );
    });

    it("rejects invalid arguments", () => {
      expectGroupError(
        () => createGroup().intersectWith(null as any),
        /Argument at index 0 is not a MajikContactGroup instance/,
      );
    });

    it("updates timestamp", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
      ]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      advanceTime("2026-02-01T00:01:00.000Z");

      first.intersectWith(second);

      expect(first.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("updates timestamp even when membership is unchanged", () => {
      const first = createGroup("first", "First", {}, [contactA.id]);

      const second = createGroup("second", "Second", {}, [
        contactA.id,
        contactB.id,
      ]);

      advanceTime("2026-02-01T00:01:00.000Z");

      first.intersectWith(second);

      expect(first.meta.updatedAt).toBe("2026-02-01T00:01:00.000Z");
    });

    it("mutates progressively before a later invalid argument throws", () => {
      const first = createGroup("first", "First", {}, [
        contactA.id,
        contactB.id,
      ]);

      const second = createGroup("second", "Second", {}, [contactB.id]);

      expectGroupError(
        () => first.intersectWith(second, {} as any),
        /Argument at index 1 is not a MajikContactGroup instance/,
      );

      expect(first.listMemberIds()).toEqual([contactB.id]);
    });

    it("can intersect a group with itself", () => {
      const group = createGroup("self", "Self", {}, [contactA.id, contactB.id]);

      group.intersectWith(group);

      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });
  });

  /* --------------------------------------------------------------------------
   * Serialization
   * ------------------------------------------------------------------------ */

  describe("JSON serialization", () => {
    it("serializes a complete custom group", () => {
      const group = createGroup(
        "group-1",
        "Engineering",
        {
          description: "Engineering team",
          photoBase64: "data:image/png;base64,AAA=",
          color: "#002968",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
        [contactA.id, contactB.id],
      );

      const json = group.toJSON();

      expect(json).toEqual({
        id: "group-1",
        meta: {
          name: "Engineering",
          description: "Engineering team",
          photoBase64: "data:image/png;base64,AAA=",
          color: "#002968",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
        memberIds: [contactA.id, contactB.id],
        isSystem: false,
      });
    });

    it("returns a defensive member array", () => {
      const group = createGroup("group", "Group", {}, [
        contactA.id,
        contactB.id,
      ]);

      const json = group.toJSON();

      json.memberIds.push(contactC.id);

      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);
    });

    it("returns a copied metadata object", () => {
      const group = createGroup("group", "Group", {
        description: "Original",
      });

      const json = group.toJSON();

      expect(json.meta).not.toBe(group.meta);

      json.meta.description = "Modified";

      expect(group.meta.description).toBe("Original");
    });

    it("round-trips a custom group", () => {
      const original = createGroup(
        "group-1",
        "Engineering",
        {
          description: "Engineering team",
          color: "#002968",
          photoBase64: "data:image/png;base64,AAA=",
        },
        [contactA.id, contactB.id],
      );

      const restored = MajikContactGroup.fromJSON(original.toJSON());

      expect(restored).toBeInstanceOf(MajikContactGroup);

      expect(restored.id).toBe(original.id);

      expect(restored.isSystem).toBe(false);

      expect(restored.meta).toEqual(original.meta);

      expect(restored.listMemberIds()).toEqual(original.listMemberIds());
    });

    it("round-trips Favorites", () => {
      const original = MajikContactGroup.createFavorites();

      original.addMember(contactA.id);

      const restored = MajikContactGroup.fromJSON(original.toJSON());

      expect(restored.isSystem).toBe(true);

      expect(restored.isFavorites()).toBe(true);

      expect(restored.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );

      expect(restored.listMemberIds()).toEqual([contactA.id]);
    });

    it("round-trips Blocked", () => {
      const original = MajikContactGroup.createBlocked();

      original.addMember(contactA.id);

      const restored = MajikContactGroup.fromJSON(original.toJSON());

      expect(restored.isSystem).toBe(true);

      expect(restored.isBlocked()).toBe(true);

      expect(restored.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED],
      );

      expect(restored.listMemberIds()).toEqual([contactA.id]);
    });

    it("rejects null serialized input", () => {
      expectGroupError(
        () => MajikContactGroup.fromJSON(null as any),
        "Invalid serialized group data",
      );
    });

    it("rejects undefined serialized input", () => {
      expectGroupError(
        () => MajikContactGroup.fromJSON(undefined as any),
        "Invalid serialized group data",
      );
    });

    it.each([
      ["string", "invalid"],
      ["number", 123],
      ["boolean", true],
      ["array", []],
    ])("rejects non-object serialized input: %s", (_label, value) => {
      expectGroupError(
        () => MajikContactGroup.fromJSON(value as any),
        "Invalid serialized group data",
      );
    });

    it("validates IDs during deserialization", () => {
      expectGroupError(
        () =>
          MajikContactGroup.fromJSON({
            id: "",
            meta: {
              name: "Group",
              description: "",
              photoBase64: null,
              createdAt: "",
              updatedAt: "",
            },
            memberIds: [],
            isSystem: false,
          }),
        "Group ID must be a non-empty string",
      );
    });

    it("validates duplicate members during deserialization", () => {
      expectGroupError(
        () =>
          MajikContactGroup.fromJSON({
            id: "group",
            meta: {
              name: "Group",
              description: "",
              photoBase64: null,
              createdAt: "",
              updatedAt: "",
            },
            memberIds: [contactA.id, contactA.id],
            isSystem: false,
          }),
        "Member IDs must not contain duplicates",
      );
    });

    it("validates malformed members during deserialization", () => {
      expectGroupError(
        () =>
          MajikContactGroup.fromJSON({
            id: "group",
            meta: {
              name: "Group",
              description: "",
              photoBase64: null,
              createdAt: "",
              updatedAt: "",
            },
            memberIds: [contactA.id, ""],
            isSystem: false,
          }),
        /Invalid member ID at index 1/,
      );
    });

    it("reapplies canonical system names during deserialization", () => {
      const restored = MajikContactGroup.fromJSON({
        id: SYSTEM_GROUP_IDS.FAVORITES,
        meta: {
          name: "Forged",
          description: "",
          photoBase64: null,
          createdAt: "",
          updatedAt: "",
        },
        memberIds: [],
        isSystem: true,
      });

      expect(restored.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );
    });

    it("defaults omitted memberIds at runtime", () => {
      const restored = MajikContactGroup.fromJSON({
        id: "group",
        meta: {
          name: "Group",
          description: "",
          photoBase64: null,
          createdAt: "",
          updatedAt: "",
        },
        isSystem: false,
      } as any);

      expect(restored.listMemberIds()).toEqual([]);
    });

    it("rejects a custom serialized group with omitted metadata", () => {
      expectGroupError(
        () =>
          MajikContactGroup.fromJSON({
            id: "group",
            memberIds: [],
            isSystem: false,
          } as any),
        "Group name must be a non-empty string",
      );
    });

    it("creates a recognized system group without metadata", () => {
      const group = new MajikContactGroup({
        id: SYSTEM_GROUP_IDS.FAVORITES,
        isSystem: true,
      });

      expect(group.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );
    });

    it("passes MajikContactGroupError through unchanged", () => {
      let thrown: unknown;

      try {
        MajikContactGroup.fromJSON({
          id: "",
          meta: {
            name: "Group",
            description: "",
            photoBase64: null,
            createdAt: "",
            updatedAt: "",
          },
          memberIds: [],
          isSystem: false,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(MajikContactGroupError);

      expect(thrown instanceof Error ? thrown.message : String(thrown)).toBe(
        "Group ID must be a non-empty string",
      );
    });
  });

  /* --------------------------------------------------------------------------
   * API Surface
   * ------------------------------------------------------------------------ */

  describe("API surface", () => {
    it("returns this from fluent mutation methods", async () => {
      const group = createGroup();

      expect(group.updateName("New Name")).toBe(group);

      expect(group.updateDescription("Description")).toBe(group);

      expect(group.setColor("#123456")).toBe(group);

      expect(group.clearColor()).toBe(group);

      await expect(group.setPhoto("aW1hZ2VkYXRh")).resolves.toBe(group);

      expect(group.clearPhoto()).toBe(group);

      expect(group.addMember(contactA.id)).toBe(group);

      expect(group.addMemberIfAbsent(contactB.id)).toBe(group);

      expect(group.addMembers([contactC.id])).toBe(group);

      expect(group.removeMember(contactA.id)).toBe(group);

      expect(group.removeMemberIfPresent(contactB.id)).toBe(group);

      expect(group.clearMembers()).toBe(group);
    });

    it("keeps instances mutable", () => {
      const group = createGroup();

      expect(Object.isFrozen(group)).toBe(false);

      expect(Object.isFrozen(group.meta)).toBe(false);
    });

    it("freezes the constructor", () => {
      expect(Object.isFrozen(MajikContactGroup)).toBe(true);
    });

    it("freezes the instance prototype", () => {
      expect(Object.isFrozen(MajikContactGroup.prototype)).toBe(true);
    });
  });
});

/* ============================================================================
 * CONTACT + GROUP INTEGRATION
 * ========================================================================== */

describe("MajikContact + MajikContactGroup integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    advanceTime("2026-03-01T00:00:00.000Z");
  });

  it("uses real cryptographic contact identities as group members", () => {
    const group = createGroup("engineering", "Engineering", {}, [
      contactA.id,
      contactB.id,
    ]);

    expect(group.hasMember(contactA.id)).toBe(true);

    expect(group.hasMember(contactB.id)).toBe(true);

    expect(group.hasMember(contactC.id)).toBe(false);
  });

  it("derives correct union and intersection from real contacts", () => {
    const engineering = createGroup("engineering", "Engineering", {}, [
      contactA.id,
      contactB.id,
    ]);

    const security = createGroup("security", "Security", {}, [
      contactB.id,
      contactC.id,
    ]);

    const merged = MajikContactGroup.merge([engineering, security], {
      id: "all-staff",
      name: "All Staff",
    });

    const shared = MajikContactGroup.intersect([engineering, security], {
      id: "shared",
      name: "Shared",
    });

    expect(merged.listMemberIds()).toEqual([
      contactA.id,
      contactB.id,
      contactC.id,
    ]);

    expect(shared.listMemberIds()).toEqual([contactB.id]);
  });

  it("preserves the cryptographic identity relationship between contact ID and fingerprint", () => {
    expect(contactA.id).toBe(keyA.fingerprint);

    expect(contactB.id).toBe(keyB.fingerprint);

    expect(contactC.id).toBe(keyC.fingerprint);
  });
});
