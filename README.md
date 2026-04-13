# Majik Contact

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)

A lightweight, cryptographically secure contact model for building zero-trust, end-to-end encrypted systems.

@majikah/majik-contact provides a structured way to represent identities using public keys, fingerprints, and post-quantum–ready cryptography (ML-KEM, ML-DSA). It is designed for use within the Majikah ecosystem and other decentralized messaging applications.

![npm](https://img.shields.io/npm/v/@majikah/majik-contact) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-contact) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

---

- [Majik Contact](#majik-contact)
  - [Features](#features)
    - [Individual Contacts (MajikContact)](#individual-contacts-majikcontact)
    - [Contact Groups (MajikContactGroup)](#contact-groups-majikcontactgroup)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Managing Individual Contacts](#managing-individual-contacts)
    - [Managing Individual Contacts](#managing-individual-contacts-1)
    - [Organizing Contacts into Groups](#organizing-contacts-into-groups)
    - [Advanced Group Operations](#advanced-group-operations)
  - [Related Projects](#related-projects)
    - [Majik Message](#majik-message)
    - [Majik Signature](#majik-signature)
    - [Majik Key](#majik-key)
    - [Majik Envelope](#majik-envelope)
  - [Contributing](#contributing)
  - [License](#license)
  - [Author](#author)
  - [Contact](#contact)

---

## Features

### Individual Contacts (MajikContact)
- **Key-Based Identity:** Uses public keys instead of usernames for identity verification.
- **Post-Quantum Ready:** Built-in support for ML-KEM and ML-DSA standards.
- **Hybrid Key Support:** Handles both WebCrypto CryptoKey objects and raw Uint8Array fallbacks.
- **Status Tracking:** Native support for blocking/unblocking and Majikah registration status.

### Contact Groups (MajikContactGroup)
- **Organization:** Group identities by custom labels or system-reserved types (e.g., Favorites, Blocked).
- **Set Operations:** Advanced membership logic including group Merging (union) and Intersection.
- **Rich Metadata:** Supports descriptions and base64-normalized photo storage.
- **Serialization:** Full JSON support for persistence in local storage or databases.


---

## Installation

```bash
# Using npm
npm install @majikah/majik-contact

```

---

## Usage

### Managing Individual Contacts
The `MajikContact` class encapsulates identity data and cryptographic public keys.

```bash

import { MajikContact } from '@majikah/majik-contact';

const contact = MajikContact.create(
  "user-uuid",
  publicKey, // CryptoKey or { raw: Uint8Array }
  "ml-kem-public-key-string",
  "fingerprint-string",
  { label: "Alice", notes: "Met at the conference" }
);

// Update details
contact.updateLabel("Alice (Lead Engineer)");
contact.block();


```

---


### Managing Individual Contacts
The `MajikContact` class encapsulates identity data and cryptographic public keys.

```bash

import { MajikContact } from '@majikah/majik-contact';

const contact = MajikContact.create(
  "user-uuid",
  publicKey, // CryptoKey or { raw: Uint8Array }
  "ml-kem-public-key-string",
  "fingerprint-string",
  { label: "Alice", notes: "Met at the conference" }
);

// Update details
contact.updateLabel("Alice (Lead Engineer)");
contact.block();


```


### Organizing Contacts into Groups
The `MajikContactGroup` class manages collections of contact IDs with built-in validation.

```bash

import { MajikContactGroup } from '@majikah/majik-contact';

// Create a custom group and add members
const team = MajikContactGroup.create('group-id', 'Engineering');
team.addMember(contact.id);

// Use System Groups
const blockedList = MajikContactGroup.createBlocked();
blockedList.addMember(contact.id);


```

### Advanced Group Operations
Perform set operations to derive new groups without manual ID management.

```bash

import { MajikContactGroup } from '@majikah/majik-contact';

// Intersection: Find contacts present in BOTH groups
const priorityContacts = MajikContactGroup.intersect([team, favorites], {
  name: "Priority Engineers"
});

// Union: Combine multiple groups into one
const allStaff = MajikContactGroup.merge([team, designGroup], {
  name: "All Staff"
});


```




---


## Related Projects

### [Majik Message](https://message.majikah.solutions)
Secure messaging platform using Majik Keys and Majik Signatures for identity-bound communication.

[Read Docs](https://majikah.solutions/products/majik-message/docs) · [Microsoft Store](https://apps.microsoft.com/detail/9pmjgvzzjspn)

[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pmjgvzzjspn)



### [Majik Signature](https://www.npmjs.com/package/@majikah/majik-signature)
Hybrid post-quantum content signing — the signing engine used by `signContent()` and `signFile()`.

[Read Docs](https://majikah.solutions/products/majik-signature/docs) · [Microsoft Store](https://apps.microsoft.com/detail/9pl9g3xzvd1x)

[![Majik Message Microsoft App Store](https://get.microsoft.com/images/en-us%20light.svg)](https://apps.microsoft.com/detail/9pl9g3xzvd1x)



### [Majik Key](https://www.npmjs.com/package/@majikah/majik-key)
Seed phrase account library — required peer dependency for signing and encryption.

[Read More Information](https://majikah.solutions/sdk/majik-key)

### [Majik Envelope](https://www.npmjs.com/package/@majikah/majik-envelope)
Post-quantum group encryption — used to encrypt and share private personal info.

[Read More Information](https://majikah.solutions/sdk/majik-envelope)

---

## Contributing

If you want to contribute or help extend support, reach out via email. All contributions are welcome!

---

## License

[Apache-2.0](LICENSE) — free for personal and commercial use.

---

## Author

Made with 💙 by [@thezelijah](https://github.com/jedlsf)

**Developer**: Josef Elijah Fabian  
**GitHub**: [https://github.com/jedlsf](https://github.com/jedlsf)  
**Project Repository**: [https://github.com/Majikah/majik-contact](https://github.com/Majikah/majik-contact)

---

## Contact

- **Business Email**: [business@thezelijah.world](mailto:business@thezelijah.world)
- **Official Website**: [https://www.thezelijah.world](https://www.thezelijah.world)