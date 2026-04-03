# Majik Contact

[![Developed by Zelijah](https://img.shields.io/badge/Developed%20by-Zelijah-red?logo=github&logoColor=white)](https://thezelijah.world) ![GitHub Sponsors](https://img.shields.io/github/sponsors/jedlsf?style=plastic&label=Sponsors&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fjedlsf)

A lightweight, cryptographically secure contact model for building zero-trust, end-to-end encrypted systems.

@majikah/majik-contact provides a structured way to represent identities using public keys, fingerprints, and post-quantum–ready cryptography (ML-KEM, ML-DSA), designed for use in Majikah and similar decentralized or secure messaging applications.

![npm](https://img.shields.io/npm/v/@majikah/majik-contact) ![npm downloads](https://img.shields.io/npm/dm/@majikah/majik-contact) [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)

---

- [Majik Contact](#majik-contact)
  - [Features](#features)
  - [Installation](#installation)
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

- Public key–based identity (no usernames required)
- Fingerprint-based verification
- Post-quantum ready (ML-KEM, ML-DSA support)
- Serialization / deserialization support
- Contact metadata (labels, notes, blocking)
- Supports both WebCrypto CryptoKey and raw key formats
- Zero-trust friendly design
  
  
---

## Installation

```bash
# Using npm
npm install @majikah/majik-contact

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