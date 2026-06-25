import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { MajikContact } from "../src/contacts/majik-contact";
import { MajikContactGroup } from "../src/contacts/majik-contact-group";
import { MajikContactError } from "../src/errors";
import { MajikMessageIdentityJSON } from "../src/types";

// Import real key generation utilities just like in majik-signature.test.ts
import { getTestKey } from "./helpers/crypto";
import { MajikKey } from "@majikah/majik-key";

// ─── 1. TEST SUITE: MAJIK CONTACT ──────────────────────────────────────────

describe("MajikContact Class", () => {
  let mockKey: MajikKey;
  let validRawKey: { raw: Uint8Array };
  let validId: string;
  let validFingerprint: string;
  let validMlKey: string;
  let expectedBase64Key: string;

  beforeAll(async () => {
    // Generate an actual key pair using your library
    mockKey = await getTestKey();

    const pubKeyBytes = mockKey.edPublicKey || new Uint8Array([1, 2, 3, 4]);
    validRawKey = { raw: pubKeyBytes };
    validId = "contact-123";
    validFingerprint = mockKey.fingerprint;
    validMlKey = mockKey.mlDsaPublicKey ? "ml-key-active" : "ml-key-123";

    // Manually calculate the base64 string that utils.ts will reliably generate
    let binary = "";
    for (let i = 0; i < pubKeyBytes.length; i++) {
      binary += String.fromCharCode(pubKeyBytes[i]);
    }
    expectedBase64Key = btoa(binary);
  }, 60000); // 60s timeout for key generation

  describe("Initialization & Validation", () => {
    it("should successfully instantiate with valid data", () => {
      const contact = new MajikContact({
        id: validId,
        publicKey: validRawKey,
        fingerprint: validFingerprint,
        mlKey: validMlKey,
      });

      expect(contact.id).toBe(validId);
      expect(contact.fingerprint).toBe(validFingerprint);
      expect(contact.mlKey).toBe(validMlKey);
      expect(contact.meta.label).toBe("");
      expect(contact.meta.blocked).toBe(false);
    });

    it("should instantiate correctly via the static create method", () => {
      const contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
        { label: "Alice" },
      );

      expect(contact.meta.label).toBe("Alice");
      expect(contact.id).toBe(validId);
    });

    it("should throw MajikContactError if initialized with invalid fields", () => {
      expect(() => new MajikContact({} as any)).toThrow(MajikContactError);

      expect(
        () =>
          new MajikContact({
            id: "",
            publicKey: validRawKey,
            fingerprint: validFingerprint,
            mlKey: validMlKey,
          }),
      ).toThrow("Contact ID must be a non-empty string");

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
  });

  describe("Majikah Status", () => {
    it("should manage Majikah registration status correctly", () => {
      const contact = MajikContact.create(
        validId,
        validRawKey,
        validMlKey,
        validFingerprint,
      );

      expect(contact.isMajikahIdentityChecked()).toBe(false);

      contact.setMajikahStatus(true);
      expect(contact.isMajikahIdentityChecked()).toBe(true);
      expect(contact.isMajikahRegistered()).toBe(true);
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

      const deserialized = MajikContact.fromJSON(json);
      expect(deserialized).toBeInstanceOf(MajikContact);
      expect(deserialized.id).toBe(contact.id);
      expect(deserialized.meta.label).toBe("Test Label");
    });

    it("should generate a valid Contact Card", async () => {
      const card = await contact.toContactCard();
      expect(card.id).toBe(validId);
      expect(card.label).toBe("Test Label");
      expect(card.publicKey).toBe(expectedBase64Key);
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
    });
  });
});

// ─── 2. TEST SUITE: MAJIK CONTACT GROUP ────────────────────────────────────

describe("MajikContactGroup Class", () => {
  const dummyGroupId = "group-1";
  const dummyGroupName = "My Friends";

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
      expect(favGroup.meta.name).toBe("Favorites");

      const blockedGroup = MajikContactGroup.createBlocked();
      expect(blockedGroup.isSystem).toBe(true);
      expect(blockedGroup.isBlocked()).toBe(true);
      expect(blockedGroup.meta.name).toBe("Blocked");
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

    it("should completely prevent renaming of System groups", () => {
      const favs = MajikContactGroup.createFavorites();
      expect(() => favs.updateName("Besties")).toThrow(/cannot be renamed/);
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
  });

  describe("Membership Management", () => {
    let group: MajikContactGroup;

    beforeEach(() => {
      group = MajikContactGroup.create(dummyGroupId, dummyGroupName);
    });

    it("should add, report, and remove single members safely", () => {
      group.addMember("contact-1");
      expect(group.hasMember("contact-1")).toBe(true);
      expect(group.memberCount()).toBe(1);

      group.removeMember("contact-1");
      expect(group.hasMember("contact-1")).toBe(false);
      expect(group.isEmpty()).toBe(true);
    });

    it("should reject duplicate direct member additions", () => {
      group.addMember("contact-1");
      expect(() => group.addMember("contact-1")).toThrow(/already a member/);
    });

    it("should respect idempotent addition and removal methods", () => {
      group.addMemberIfAbsent("contact-1");
      group.addMemberIfAbsent("contact-1"); // Should not throw
      expect(group.memberCount()).toBe(1);

      group.removeMemberIfPresent("contact-2"); // Should not throw
      expect(group.memberCount()).toBe(1);
    });

    it("should handle bulk additions and detect duplicates", () => {
      group.addMembers(["c-1", "c-2", "c-3"]);
      expect(group.memberCount()).toBe(3);
      expect(group.listMemberIds()).toEqual(["c-1", "c-2", "c-3"]);

      expect(() => group.addMembers(["c-3", "c-4"])).toThrow(
        /already members: c-3/,
      );
    });
  });

  describe("Group Set Operations (Merge & Intersect)", () => {
    let g1: MajikContactGroup;
    let g2: MajikContactGroup;
    let g3: MajikContactGroup;

    beforeEach(() => {
      g1 = MajikContactGroup.create("g1", "Group 1", {}, ["a", "b", "c"]);
      g2 = MajikContactGroup.create("g2", "Group 2", {}, ["b", "c", "d"]);
      g3 = MajikContactGroup.create("g3", "Group 3", {}, ["c", "e", "f"]);
    });

    describe("Static Operations", () => {
      it("should successfully merge multiple groups into a new unique group", () => {
        const merged = MajikContactGroup.merge([g1, g2, g3], {
          name: "Merged Group",
        });
        expect(merged.meta.name).toBe("Merged Group");
        expect(merged.memberCount()).toBe(6);
        expect(merged.listMemberIds().sort()).toEqual([
          "a",
          "b",
          "c",
          "d",
          "e",
          "f",
        ]);
      });

      it("should successfully intersect multiple groups into a new unique group", () => {
        const intersected = MajikContactGroup.intersect([g1, g2, g3], {
          name: "Common",
        });
        expect(intersected.meta.name).toBe("Common");
        expect(intersected.memberCount()).toBe(1);
        expect(intersected.listMemberIds()).toEqual(["c"]);
      });
    });

    describe("Instance Operations", () => {
      it("should mutate the instance correctly via mergeWith", () => {
        g1.mergeWith(g2, g3);
        expect(g1.memberCount()).toBe(6);
        expect(g1.listMemberIds().sort()).toEqual([
          "a",
          "b",
          "c",
          "d",
          "e",
          "f",
        ]);
      });

      it("should mutate the instance correctly via intersectWith", () => {
        g1.intersectWith(g2); // Should leave ["b", "c"]
        expect(g1.listMemberIds().sort()).toEqual(["b", "c"]);

        g1.intersectWith(g3); // Should leave ["c"]
        expect(g1.listMemberIds()).toEqual(["c"]);
      });
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON and cleanly deserialize", () => {
      const group = MajikContactGroup.create(
        "g1",
        "My Group",
        { description: "Desc" },
        ["m1", "m2"],
      );

      const json = group.toJSON();
      expect(json.id).toBe("g1");
      expect(json.memberIds).toEqual(["m1", "m2"]);

      const restored = MajikContactGroup.fromJSON(json);
      expect(restored.id).toBe(group.id);
      expect(restored.meta.name).toBe("My Group");
      expect(restored.meta.description).toBe("Desc");
      expect(restored.hasMember("m1")).toBe(true);
    });
  });
});
