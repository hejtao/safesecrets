# What is safesecrets

Safesecrets is a desktop application for securely storing and managing sensitive information like passwords, mnemonics, and other credentials. Built with Tauri and React, it provides:

- Strong encryption for your secrets
- Local storage - your data never leaves your device
- Simple and intuitive interface
- Open source and auditable code

## Demo Video

[![Watch the demo video](https://img.youtube.com/vi/Xd-GzsMoS3A/maxresdefault.jpg)](https://www.youtube.com/watch?v=Xd-GzsMoS3A)

_Click the image above to watch the demo video on YouTube_

# How is your data encrypted

![Encryption Diagram](diagram.png)

# Build from source

For security reasons, pre-built binaries are not provided. Safesecrets is entirely based on local storage and never interacts with any remote servers.
We highly recommend reviewing the source code before building your own application.

## Prerequisites

- [Node.js v20+](https://nodejs.org/en/download)
- [Rust v1.82+](https://www.rust-lang.org/tools/install)

## Steps for both windows and macOS

```bash
git clone git@github.com:hejtao/safesecrets.git
cd safesecrets
cargo build --manifest-path ./src-tauri/Cargo.toml
npm install
npm run tauri:build
```
