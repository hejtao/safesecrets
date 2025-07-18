# What is safesecrets

Safesecrets is a desktop application for securely storing and managing sensitive information like passwords, mnemonics, and other credentials. Built with Tauri and React, it provides:

- Strong encryption for your secrets
- Local storage - your data never leaves your device
- Simple and intuitive interface
- Open source and auditable code

Watch the demo video on YouTube:

<iframe width="560" height="315" src="https://www.youtube.com/embed/Xd-GzsMoS3A?si=npqTeXAXLzst3bIK" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

# How is your data encrypted

![Encryption Diagram](diagram.png)

# Install

```bash
git clone git@github.com:hejtao/safesecrets.git
cd safesecrets
yarn install
yarn tauri:build
```
