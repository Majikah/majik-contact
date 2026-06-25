import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { MajikContact } from "../src/contacts/majik-contact";
import { MajikContactGroup } from "../src/contacts/majik-contact-group";
import { MajikContactError, MajikContactGroupError } from "../src/errors";
import { MajikMessageIdentityJSON } from "../src/types";
import { SYSTEM_GROUP_IDS, SYSTEM_GROUP_NAMES } from "../src/constants";

// Import real key generation utilities just like in majik-signature.test.ts
import { getTestKey } from "./helpers/crypto";
import { MajikKey } from "@majikah/majik-key";
import { arrayBufferToBase64 } from "../src/utils";

/* -------------------------------
 * Shared Helpers
 * ------------------------------- */

/** Wraps a MajikKey's Ed25519 public key into the raw-key shape MajikContact expects. */
function rawKeyFrom(key: MajikKey): { raw: Uint8Array } {
  return { raw: key.edPublicKey || new Uint8Array([1, 2, 3, 4]) };
}

/** Mirrors the base64 encoding utils.ts is expected to produce for a raw public key. */
function expectedBase64For(rawKey: { raw: Uint8Array }): string {
  let binary = "";
  for (let i = 0; i < rawKey.raw.length; i++) {
    binary += String.fromCharCode(rawKey.raw[i]);
  }
  return btoa(binary);
}

// ─── 1. TEST SUITE: MAJIK CONTACT ──────────────────────────────────────────

describe("MajikContact Class", () => {
  let mockKey: MajikKey;
  let validRawKey: { raw: Uint8Array };
  let validId: string;
  let validFingerprint: string;
  let validMlKey: string;
  let validMlDsaKey: string;
  let expectedBase64Key: string;

  beforeAll(async () => {
    // Generate an actual key pair using your library
    mockKey = await getTestKey();
    console.log("[majik-key] Test Key Created");

    const testContact = mockKey.toContact();

    validRawKey = rawKeyFrom(mockKey);
    validId = mockKey.fingerprint;
    validFingerprint = mockKey.fingerprint;
    validMlKey = testContact.mlKey;
    validMlDsaKey = testContact.mlDsaPublicKeyBase64;
    expectedBase64Key = expectedBase64For(validRawKey);
  }, 60000); // 60s timeout for key generation

  describe("Initialization & Validation", () => {
    it("should successfully instantiate with valid data", () => {
      const contact = mockKey.toContact();
      expect(contact.id).toBe(validId);
      expect(contact.fingerprint).toBe(validFingerprint);
      expect(contact.mlKey).toBe(validMlKey);
      expect(contact.mlDsaPublicKeyBase64).toBe(validMlDsaKey);
      expect(contact.meta.notes).toBe("");
      expect(contact.meta.blocked).toBe(false);
      expect(contact.mlDsaPublicKeyBase64).toBe(validMlDsaKey);
    });

    it("should instantiate correctly via the static create method, including optional PQ key fields", () => {
      const contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
        { label: "Alice" },
        "ed-b64-stub",
        "mldsa-b64-stub",
      );

      expect(contact.meta.label).toBe("Alice");
      expect(contact.id).toBe(validId);
      expect(contact.edPublicKeyBase64).toBe("ed-b64-stub");
      expect(contact.mlDsaPublicKeyBase64).toBe("mldsa-b64-stub");
    });

    it("should default Majikah identity status to 'unchecked' on creation", () => {
      const contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
      );
      expect(contact.isMajikahIdentityChecked()).toBe(false);
      expect(contact.isMajikahRegistered()).toBe(false);
    });

    describe("Field validation failures", () => {
      it("should throw MajikContactError if initialized with no fields at all", () => {
        expect(() => new MajikContact({} as any)).toThrow(MajikContactError);
      });

      it("should reject an empty id", () => {
        expect(
          () =>
            new MajikContact({
              id: "",
              publicKey: validRawKey,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).toThrow("Contact ID must be a non-empty string");
      });

      it("should reject a non-string id", () => {
        expect(
          () =>
            new MajikContact({
              id: 12345 as any,
              publicKey: validRawKey,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).toThrow("Contact ID must be a non-empty string");
      });

      it("should reject a null public key", () => {
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: null as any,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).toThrow("Invalid public key");
      });

      it("should reject a public key object with neither `type: 'public'` nor a `raw` Uint8Array", () => {
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: {} as any,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).toThrow("Invalid public key");

        // A plain array isn't a Uint8Array, so the `raw` shortcut doesn't apply either
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: { raw: [1, 2, 3] } as any,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).toThrow("Invalid public key");
      });

      it("should accept a public key object that merely declares `type: 'public'`, even if it isn't a real CryptoKey", () => {
        const fakeCryptoKey = { type: "public" } as unknown as CryptoKey;
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: fakeCryptoKey,
              fingerprint: validFingerprint,
              mlKey: validMlKey,
            }),
        ).not.toThrow();
      });

      it("should reject an empty ML key", () => {
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: validRawKey,
              fingerprint: validFingerprint,
              mlKey: "",
            }),
        ).toThrow("ML Key must be a non-empty string");
      });

      it("should reject an empty fingerprint", () => {
        expect(
          () =>
            new MajikContact({
              id: validId,
              publicKey: validRawKey,
              fingerprint: "",
              mlKey: validMlKey,
            }),
        ).toThrow("Fingerprint must be a non-empty string");
      });
    });
  });

  describe("Metadata Mutation", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
      );
    });

    it("should update metadata partially via updateMeta", () => {
      contact.updateMeta({ label: "Bob", notes: "A good friend" });
      expect(contact.meta.label).toBe("Bob");
      expect(contact.meta.notes).toBe("A good friend");
    });

    it("should reject non-object updates passed to updateMeta", () => {
      expect(() => contact.updateMeta(null as any)).toThrow(
        "Metadata updates must be provided as a valid object",
      );
      expect(() => contact.updateMeta("label" as any)).toThrow(
        "Metadata updates must be provided as a valid object",
      );
      // Arrays pass `typeof === "object"` in JS but are explicitly rejected
      expect(() => contact.updateMeta([] as any)).toThrow(
        "Metadata updates must be provided as a valid object",
      );
    });

    it("should specifically update label and notes with timestamps", async () => {
      const originalTime = contact.meta.updatedAt;

      // Wait 10ms to ensure the clock ticks forward for the ISO string millisecond
      await new Promise((resolve) => setTimeout(resolve, 10));

      contact.updateLabel("Charlie");
      contact.updateNotes("Met at conference");

      expect(contact.meta.label).toBe("Charlie");
      expect(contact.meta.notes).toBe("Met at conference");
      expect(contact.meta.updatedAt).not.toBe(originalTime);
    });

    it("should reject non-string values passed to updateLabel and updateNotes", () => {
      expect(() => contact.updateLabel(42 as any)).toThrow(
        "Label must be a string",
      );
      expect(() => contact.updateNotes(42 as any)).toThrow(
        "Notes must be a string",
      );
    });

    it("should reject non-boolean values passed to setBlocked", () => {
      expect(() => contact.setBlocked("yes" as any)).toThrow(
        "Blocked must be boolean",
      );
    });

    it("should cleanly handle block and unblock idempotently", () => {
      expect(contact.isBlocked()).toBe(false);

      contact.block();
      expect(contact.isBlocked()).toBe(true);

      // Idempotent test
      contact.block();
      expect(contact.isBlocked()).toBe(true);

      contact.unblock();
      expect(contact.isBlocked()).toBe(false);
    });

    it("should leave updatedAt untouched on no-op block()/unblock() calls, but bump it on real transitions", async () => {
      const initialTime = contact.meta.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      contact.unblock(); // already unblocked -> no-op, setBlocked() never called
      expect(contact.meta.updatedAt).toBe(initialTime);

      await new Promise((resolve) => setTimeout(resolve, 10));
      contact.block(); // real transition -> updateTimestamp() fires
      expect(contact.meta.updatedAt).not.toBe(initialTime);
    });

    it("should reflect blocked state via the static MajikContact.isBlocked helper", () => {
      expect(MajikContact.isBlocked(contact)).toBe(false);
      contact.block();
      expect(MajikContact.isBlocked(contact)).toBe(true);
    });
  });

  describe("Majikah Status", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
      );
    });

    it("should manage Majikah registration status correctly", () => {
      expect(contact.isMajikahIdentityChecked()).toBe(false);

      contact.setMajikahStatus(true);
      expect(contact.isMajikahIdentityChecked()).toBe(true);
      expect(contact.isMajikahRegistered()).toBe(true);
    });

    it("should distinguish 'checked but not registered' from 'never checked'", () => {
      expect(contact.isMajikahIdentityChecked()).toBe(false);

      contact.setMajikahStatus(false);
      expect(contact.isMajikahIdentityChecked()).toBe(true); // it HAS been checked now...
      expect(contact.isMajikahRegistered()).toBe(false); // ...the check just came back negative
    });
  });

  describe("Serialization & Generation", () => {
    let contact: MajikContact;

    beforeEach(() => {
      contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
        { label: "Test Label" },
      );
    });

    it("should correctly resolve display name (label fallback to base64 key)", async () => {
      expect(await contact.getDisplayName()).toBe("Test Label");

      const noLabelContact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
      );
      expect(await noLabelContact.getDisplayName()).toBe(expectedBase64Key);
    });

    it("should serialize to JSON and cleanly deserialize", async () => {
      const json = await contact.toJSON();
      expect(json.id).toBe(validId);
      expect(json.publicKeyBase64).toBe(expectedBase64Key);
      expect(json.majikah_registered).toBeUndefined(); // never explicitly set

      const deserialized = MajikContact.fromJSON(json);
      expect(deserialized).toBeInstanceOf(MajikContact);
      expect(deserialized.id).toBe(contact.id);
      expect(deserialized.fingerprint).toBe(contact.fingerprint);
      expect(deserialized.meta.label).toBe("Test Label");
    });

    it("should preserve PQ key material and the Majikah status flag through a JSON roundtrip", async () => {
      const pqContact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
        { label: "PQ" },
        "ed-stub",
        "mldsa-stub",
      ).setMajikahStatus(true);

      const json = await pqContact.toJSON();
      expect(json.edPublicKeyBase64).toBe("ed-stub");
      expect(json.mlDsaPublicKeyBase64).toBe("mldsa-stub");
      expect(json.majikah_registered).toBe(true);

      const deserialized = MajikContact.fromJSON(json);
      expect(deserialized.edPublicKeyBase64).toBe("ed-stub");
      expect(deserialized.mlDsaPublicKeyBase64).toBe("mldsa-stub");
    });

    it("should wrap base64 decoding failures from fromJSON in a MajikContactError", () => {
      expect(() =>
        MajikContact.fromJSON({
          id: validId,
          fingerprint: validFingerprint,
          mlKey: validMlKey,
          publicKeyBase64: "!!!not-valid-base64!!!",
        } as any),
      ).toThrow(MajikContactError);
    });

    it("should generate a valid Contact Card", async () => {
      const card = await contact.toContactCard();
      expect(card.id).toBe(validId);
      expect(card.label).toBe("Test Label");
      expect(card.publicKey).toBe(expectedBase64Key);
      expect(card.fingerprint).toBe(validFingerprint);
      expect(card.mlKey).toBe(validMlKey);
    });

    it("should resolve the public key via the raw-key fallback path in getPublicKeyBase64", async () => {
      // validRawKey is a { raw: Uint8Array } wrapper, not a real CryptoKey, so this
      // exercises the catch-and-fallback branch rather than crypto.subtle.exportKey.
      const result = await contact.getPublicKeyBase64();
      expect(result).toBe(expectedBase64Key);
    });

    it("should reject getPublicKeyBase64 when the key is neither a real CryptoKey nor a raw-key wrapper", async () => {
      const fakeCryptoKeyContact = new MajikContact({
        id: validId,
        publicKey: { type: "public" } as unknown as CryptoKey,
        fingerprint: validFingerprint,
        mlKey: validMlKey,
      });

      // This passes constructor validation (type === 'public'), but subtle.exportKey
      // will reject because it isn't a real CryptoKey, and there's no `.raw` to fall
      // back to -- so the original error should propagate.
      await expect(fakeCryptoKeyContact.getPublicKeyBase64()).rejects.toThrow();
    });

    it("should also reject toContactCard for the same fake-CryptoKey case, since toContactCard has no fallback path", async () => {
      const fakeCryptoKeyContact = new MajikContact({
        id: validId,
        publicKey: { type: "public" } as unknown as CryptoKey,
        fingerprint: validFingerprint,
        mlKey: validMlKey,
      });

      await expect(fakeCryptoKeyContact.toContactCard()).rejects.toThrow();
    });

    it("should instantiate successfully from MajikMessageIdentityJSON", async () => {
      const identityJson: MajikMessageIdentityJSON = {
        id: "id-456",
        user_id: "user-456",
        public_key: expectedBase64Key,
        ml_key: "ml-key-456",
        phash: "hash",
        label: "Remote User",
        timestamp: new Date().toISOString(),
        restricted: true,
      };

      const importedContact = await MajikContact.fromIdentityJSON(identityJson);
      expect(importedContact.id).toBe("id-456");
      expect(importedContact.mlKey).toBe("ml-key-456");
      expect(importedContact.meta.label).toBe("Remote User");
      expect(importedContact.isBlocked()).toBe(true);
      expect(importedContact.isMajikahRegistered()).toBe(true);

      // fromIdentityJSON intentionally derives the fingerprint from the identity's `id`
      // field, NOT from `phash` -- pin this down explicitly so it can't silently drift.
      expect(importedContact.fingerprint).toBe("id-456");
    });

    it("should wrap failures in fromIdentityJSON in a MajikContactError", async () => {
      const badIdentityJson: MajikMessageIdentityJSON = {
        id: "id-789",
        user_id: "user-789",
        public_key: "!!!not-valid-base64!!!",
        ml_key: "ml-key-789",
        phash: "hash",
        label: "Bad User",
        timestamp: new Date().toISOString(),
        restricted: false,
      };

      await expect(
        MajikContact.fromIdentityJSON(badIdentityJson),
      ).rejects.toThrow(MajikContactError);
    });
  });
});

// ─── 2. TEST SUITE: MAJIK CONTACT GROUP ────────────────────────────────────

describe("MajikContactGroup Class", () => {
  const dummyGroupId = "group-1";
  const dummyGroupName = "My Friends";

  // Three independently-generated real identities, used to simulate realistic
  // crypto-backed group membership (instead of arbitrary placeholder strings)
  // wherever the overlap *between* groups is actually what's under test.
  let keyA: MajikKey;
  let keyB: MajikKey;
  let keyC: MajikKey;
  let contactA: MajikContact;
  let contactB: MajikContact;
  let contactC: MajikContact;

  beforeAll(async () => {
    console.log(
      "[majik-contact-group.test] Generating 3 real test identities...",
    );
    keyA = await getTestKey();
    console.log("[majik-key] Key A Created");

    keyB = await getTestKey();
    console.log("[majik-key] Key B Created");

    keyC = await getTestKey();
    console.log("[majik-key] Key C Created");

    contactA = MajikContact.create(
      "contact-A",
      rawKeyFrom(keyA),
      "ml-key-A",
      keyA.fingerprint,
      { label: "Alice" },
    );
    console.log("[majik-key] Contact A Created");

    contactB = MajikContact.create(
      "contact-B",
      rawKeyFrom(keyB),
      "ml-key-B",
      keyB.fingerprint,
      { label: "Bob" },
    );
    console.log("[majik-key] Contact B Created");

    contactC = MajikContact.create(
      "contact-C",
      rawKeyFrom(keyC),
      "ml-key-C",
      keyC.fingerprint,
      { label: "Carol" },
    );
    console.log("[majik-key] Contact C Created");

    // Sanity check: the three generated keys must actually be distinct, or the
    // overlap assertions below would be meaningless.
    expect(
      new Set([keyA.fingerprint, keyB.fingerprint, keyC.fingerprint]).size,
    ).toBe(3);
  }, 120000); // 3 real key derivations -> generous timeout

  describe("Initialization & Validation", () => {
    it("should instantiate a standard user group correctly", () => {
      const group = MajikContactGroup.create(dummyGroupId, dummyGroupName);

      expect(group.id).toBe(dummyGroupId);
      expect(group.isSystem).toBe(false);
      expect(group.meta.name).toBe(dummyGroupName);
      expect(group.isEmpty()).toBe(true);
    });

    it("should instantiate system groups securely via static factories", () => {
      const favGroup = MajikContactGroup.createFavorites();
      expect(favGroup.isSystem).toBe(true);
      expect(favGroup.isFavorites()).toBe(true);
      expect(favGroup.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );

      const blockedGroup = MajikContactGroup.createBlocked();
      expect(blockedGroup.isSystem).toBe(true);
      expect(blockedGroup.isBlocked()).toBe(true);
      expect(blockedGroup.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.BLOCKED],
      );
    });

    it("should ignore a user-supplied name for a recognized system group ID and force the canonical locked name", () => {
      const group = new MajikContactGroup({
        id: SYSTEM_GROUP_IDS.FAVORITES,
        isSystem: true,
        meta: { name: "Hacked Custom Name" },
      });

      expect(group.meta.name).toBe(
        SYSTEM_GROUP_NAMES[SYSTEM_GROUP_IDS.FAVORITES],
      );
    });

    it("should NOT enforce name validation when isSystem is true but the ID isn't a recognized system ID", () => {
      // Neither the system-name-lock branch (unrecognized ID) nor the standard
      // assertName branch (only runs when !isSystem) applies here, so an empty
      // name slips through uncontested. This pins down actual current behavior.
      expect(
        () =>
          new MajikContactGroup({
            id: "not-a-real-system-id",
            isSystem: true,
            meta: { name: "" },
          }),
      ).not.toThrow();
    });

    it("should enforce name length and reserved word validations", () => {
      const longName = "A".repeat(65);
      expect(() => MajikContactGroup.create("g-2", longName)).toThrow(
        /must not exceed 64 characters/,
      );

      expect(() => MajikContactGroup.create("g-3", "Favorites")).toThrow(
        /reserved system group name/,
      );
      expect(() => MajikContactGroup.create("g-4", "bLoCkeD")).toThrow(
        /reserved system group name/,
      );
    });

    it("should reject an empty name for a non-system group", () => {
      expect(() => MajikContactGroup.create("g-5", "")).toThrow(
        "Group name must be a non-empty string",
      );
    });

    it("should reject an empty or whitespace-only group ID", () => {
      expect(() => MajikContactGroup.create("", "Some Name")).toThrow(
        "Group ID must be a non-empty string",
      );
      expect(() => MajikContactGroup.create("   ", "Some Name")).toThrow(
        "Group ID must be a non-empty string",
      );
    });

    it("should reject duplicate member IDs supplied at construction time", () => {
      expect(() =>
        MajikContactGroup.create("g-6", "Dup Test", {}, [
          contactA.id,
          contactA.id,
        ]),
      ).toThrow(MajikContactGroupError);
      expect(() =>
        MajikContactGroup.create("g-6", "Dup Test", {}, [
          contactA.id,
          contactA.id,
        ]),
      ).toThrow(/must not contain duplicates/);
    });

    it("should reject invalid (empty) member ID entries supplied at construction time", () => {
      expect(() =>
        MajikContactGroup.create("g-7", "Invalid Member Test", {}, [
          contactA.id,
          "",
          contactB.id,
        ]),
      ).toThrow(/Invalid member ID at index 1/);
    });
  });

  describe("Metadata Mutations", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = MajikContactGroup.create(dummyGroupId, dummyGroupName);
    });

    it("should update standard metadata fields", () => {
      group.updateName("Close Friends");
      expect(group.meta.name).toBe("Close Friends");

      group.updateDescription("People I talk to often");
      expect(group.meta.description).toBe("People I talk to often");

      group.setColor("#FF0000");
      expect(group.meta.color).toBe("#FF0000");

      group.clearColor();
      expect(group.meta.color).toBeUndefined();
    });

    it("should trim whitespace from updated names and descriptions", () => {
      group.updateName("  Close Friends  ");
      expect(group.meta.name).toBe("Close Friends");

      group.updateDescription("  trimmed  ");
      expect(group.meta.description).toBe("trimmed");
    });

    it("should reject a non-string description", () => {
      expect(() => group.updateDescription(42 as any)).toThrow(
        "Description must be a string",
      );
    });

    it("should completely prevent renaming of System groups", () => {
      const favs = MajikContactGroup.createFavorites();
      expect(() => favs.updateName("Besties")).toThrow(/cannot be renamed/);
    });

    it("should reject overlong or reserved names on update, same as on creation", () => {
      expect(() => group.updateName("A".repeat(65))).toThrow(
        /must not exceed 64 characters/,
      );
      expect(() => group.updateName("Blocked")).toThrow(
        /reserved system group name/,
      );
    });

    it("should safely handle photo states", async () => {
      // Must supply an actual valid base64 string to pass utility validation
      const validBase64 = "aW1hZ2VkYXRh"; // base64 for "imagedata"
      await group.setPhoto(validBase64);

      expect(group.hasPhoto()).toBe(true);
      // The utility correctly prefixes raw base64 strings with standard headers
      expect(group.meta.photoBase64).toBe(
        `data:image/jpeg;base64,${validBase64}`,
      );

      group.clearPhoto();
      expect(group.hasPhoto()).toBe(false);
      expect(group.meta.photoBase64).toBeNull();
    });

    it("should reject null or undefined photo input, pointing callers at clearPhoto() instead", async () => {
      await expect(group.setPhoto(null)).rejects.toThrow(
        /must not be null or undefined/,
      );
      await expect(group.setPhoto(undefined)).rejects.toThrow(
        /must not be null or undefined/,
      );
    });
  });

  describe("Membership Management", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = MajikContactGroup.create(dummyGroupId, dummyGroupName);
    });

    it("should add, report, and remove single members safely", () => {
      group.addMember(contactA.id);
      expect(group.hasMember(contactA.id)).toBe(true);
      expect(group.memberCount()).toBe(1);

      group.removeMember(contactA.id);
      expect(group.hasMember(contactA.id)).toBe(false);
      expect(group.isEmpty()).toBe(true);
    });

    it("should reject duplicate direct member additions", () => {
      group.addMember(contactA.id);
      expect(() => group.addMember(contactA.id)).toThrow(/already a member/);
    });

    it("should throw when removing a contact that isn't actually a member", () => {
      expect(() => group.removeMember(contactA.id)).toThrow(
        /is not a member of group/,
      );
    });

    it("should reject empty/whitespace-only contact IDs across membership methods", () => {
      expect(() => group.addMember("")).toThrow(
        "Contact ID must be a non-empty string",
      );
      expect(() => group.hasMember("   ")).toThrow(
        "Contact ID must be a non-empty string",
      );
      expect(() => group.removeMember("")).toThrow(
        "Contact ID must be a non-empty string",
      );
    });

    it("should respect idempotent addition and removal methods", () => {
      group.addMemberIfAbsent(contactA.id);
      group.addMemberIfAbsent(contactA.id); // Should not throw
      expect(group.memberCount()).toBe(1);

      group.removeMemberIfPresent(contactB.id); // Should not throw, was never a member
      expect(group.memberCount()).toBe(1);
    });

    it("should handle bulk additions and detect duplicates against existing members", () => {
      group.addMembers([contactA.id, contactB.id]);
      expect(group.memberCount()).toBe(2);
      expect(group.listMemberIds()).toEqual([contactA.id, contactB.id]);

      expect(() => group.addMembers([contactB.id, contactC.id])).toThrow(
        new RegExp(`already members: ${contactB.id}`),
      );
    });

    it("should reject a bulk addition whose input array itself has internal duplicates, before ever checking existing membership", () => {
      // This is validated by assertMemberIds first, so it surfaces as "must not
      // contain duplicates" rather than the "already members" runtime check --
      // even though contactA was never added to the group at all.
      expect(() => group.addMembers([contactA.id, contactA.id])).toThrow(
        /must not contain duplicates/,
      );
    });
  });

  describe("Group Set Operations (Merge & Intersect) using real cryptographic identities", () => {
    // groupAB and groupBC share contactB; groupBC and groupCA share contactC;
    // groupCA and groupAB share contactA. No single identity is common to all three.
    let groupAB: MajikContactGroup;
    let groupBC: MajikContactGroup;
    let groupCA: MajikContactGroup;

    beforeEach(() => {
      groupAB = MajikContactGroup.create("group-ab", "Group AB", {}, [
        contactA.id,
        contactB.id,
      ]);
      groupBC = MajikContactGroup.create("group-bc", "Group BC", {}, [
        contactB.id,
        contactC.id,
      ]);
      groupCA = MajikContactGroup.create("group-ca", "Group CA", {}, [
        contactC.id,
        contactA.id,
      ]);
    });

    describe("Static Operations", () => {
      it("should union all three identities when merging groups that only pairwise overlap", () => {
        const merged = MajikContactGroup.merge([groupAB, groupBC, groupCA], {
          name: "Everyone",
        });
        expect(merged.meta.name).toBe("Everyone");
        expect(merged.memberCount()).toBe(3);
        expect(merged.listMemberIds().sort()).toEqual(
          [contactA.id, contactB.id, contactC.id].sort(),
        );
        expect(merged.isSystem).toBe(false);
      });

      it("should find no common member when intersecting all three pairwise-overlapping groups", () => {
        // contactA is in groupAB & groupCA but not groupBC; contactB is in groupAB &
        // groupBC but not groupCA; contactC is in groupBC & groupCA but not groupAB.
        // No identity belongs to all three simultaneously.
        const intersected = MajikContactGroup.intersect(
          [groupAB, groupBC, groupCA],
          {
            name: "Common To All Three",
          },
        );
        expect(intersected.memberCount()).toBe(0);
        expect(intersected.isEmpty()).toBe(true);
      });

      it("should find exactly the one shared identity when intersecting just two overlapping groups", () => {
        const intersected = MajikContactGroup.intersect([groupAB, groupBC]);
        expect(intersected.listMemberIds()).toEqual([contactB.id]);
      });

      it("should default the resulting ID and name to the first group's values when no overrides are given", () => {
        const merged = MajikContactGroup.merge([groupAB, groupBC]);
        expect(merged.id).toBe(groupAB.id);
        expect(merged.meta.name).toBe(groupAB.meta.name);
      });

      it("should inherit description and photo metadata from the first group passed in", async () => {
        groupAB.updateDescription("The AB description");
        await groupAB.setPhoto("aW1hZ2VkYXRh");

        const merged = MajikContactGroup.merge([groupAB, groupBC]);
        expect(merged.meta.description).toBe("The AB description");
        expect(merged.meta.photoBase64).toBe(groupAB.meta.photoBase64);
      });

      it("should never mark a merge/intersect result as a system group, even when merging a real system group", () => {
        const favs = MajikContactGroup.createFavorites();
        favs.addMember(contactA.id);

        // Gotcha: the merge result inherits the literal name "Favorites" from the
        // source group, but is constructed with isSystem: false. That re-triggers
        // the reserved-name guard in the constructor, which now rejects "Favorites"
        // as an ordinary (non-system) group name.
        expect(() => MajikContactGroup.merge([favs, groupAB])).toThrow(
          /reserved system group name/,
        );

        // Supplying an explicit override name sidesteps the collision entirely.
        const merged = MajikContactGroup.merge([favs, groupAB], {
          name: "Favorites Snapshot",
        });
        expect(merged.isSystem).toBe(false);
        expect(merged.meta.name).toBe("Favorites Snapshot");
        expect(merged.memberCount()).toBe(2); // contactA (shared) + contactB
      });

      it("should require at least two groups for both merge and intersect", () => {
        expect(() => MajikContactGroup.merge([groupAB])).toThrow(
          /requires at least two groups/,
        );
        expect(() => MajikContactGroup.intersect([])).toThrow(
          /requires at least two groups/,
        );
      });
    });

    describe("Instance Operations", () => {
      it("should mutate the instance correctly via mergeWith", () => {
        groupAB.mergeWith(groupBC, groupCA);
        expect(groupAB.memberCount()).toBe(3);
        expect(groupAB.listMemberIds().sort()).toEqual(
          [contactA.id, contactB.id, contactC.id].sort(),
        );
      });

      it("should progressively narrow membership down to empty via sequential intersectWith calls", () => {
        // groupAB = [A, B]; intersecting with groupBC = [B, C] leaves only B.
        groupAB.intersectWith(groupBC);
        expect(groupAB.listMemberIds()).toEqual([contactB.id]);

        // Intersecting the now-single-member group with groupCA = [C, A], which
        // does NOT contain B, empties it out completely.
        groupAB.intersectWith(groupCA);
        expect(groupAB.isEmpty()).toBe(true);
      });

      it("should reject mergeWith/intersectWith calls made with no arguments", () => {
        expect(() => groupAB.mergeWith()).toThrow(
          /requires at least one other group/,
        );
        expect(() => groupAB.intersectWith()).toThrow(
          /requires at least one other group/,
        );
      });

      it("should reject mergeWith/intersectWith arguments that aren't MajikContactGroup instances", () => {
        expect(() => groupAB.mergeWith({} as any)).toThrow(
          /is not a MajikContactGroup instance/,
        );
        expect(() => groupAB.intersectWith({} as any)).toThrow(
          /is not a MajikContactGroup instance/,
        );
      });
    });
  });

  describe("Integration: Real Contact Identities as Group Members", () => {
    it("should let group membership be queried using genuine MajikContact ids backed by distinct cryptographic keys", () => {
      const group = MajikContactGroup.create(
        "integration-group",
        "Integration Group",
        {},
        [contactA.id, contactB.id],
      );

      expect(group.hasMember(contactA.id)).toBe(true);
      expect(group.hasMember(contactC.id)).toBe(false);

      // Confirm the member id actually traces back to a real, distinct key fingerprint.
      expect(contactA.fingerprint).toBe(keyA.fingerprint);
      expect(contactA.fingerprint).not.toBe(contactB.fingerprint);
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON and cleanly deserialize", () => {
      const group = MajikContactGroup.create(
        "g1",
        "My Group",
        { description: "Desc", color: "#abcdef" },
        [contactA.id, contactB.id],
      );

      const json = group.toJSON();
      expect(json.id).toBe("g1");
      expect(json.memberIds).toEqual([contactA.id, contactB.id]);
      expect(json.isSystem).toBe(false);

      const restored = MajikContactGroup.fromJSON(json);
      expect(restored.id).toBe(group.id);
      expect(restored.meta.name).toBe("My Group");
      expect(restored.meta.description).toBe("Desc");
      expect(restored.meta.color).toBe("#abcdef");
      expect(restored.hasMember(contactA.id)).toBe(true);
    });

    it("should reject null or non-object input to fromJSON outright", () => {
      expect(() => MajikContactGroup.fromJSON(null as any)).toThrow(
        "Invalid serialized group data",
      );
      expect(() => MajikContactGroup.fromJSON(undefined as any)).toThrow(
        "Invalid serialized group data",
      );
    });

    it("should pass internal validation errors through fromJSON unwrapped, rather than double-wrapping them", () => {
      // assertId already throws a MajikContactGroupError, so fromJSON's catch block
      // should rethrow it as-is instead of wrapping it in a generic
      // "Failed to deserialize" message.
      expect(() =>
        MajikContactGroup.fromJSON({
          id: "",
          meta: {
            name: "Whatever",
            description: "",
            photoBase64: null,
            createdAt: "",
            updatedAt: "",
          },
          memberIds: [],
          isSystem: false,
        }),
      ).toThrow("Group ID must be a non-empty string");
    });
  });
});
