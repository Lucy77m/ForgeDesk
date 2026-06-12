# Security Policy

ForgeDesk is a local-first CLI. It reads local git metadata and writes local
ForgeDesk files under `.forgedesk/`.

## Supported Versions

Security fixes target the latest published ForgeDesk release.

## Reporting A Vulnerability

Use GitHub security reporting or open an issue at:

https://github.com/Lucy77m/ForgeDesk/issues

Do not include secrets, tokens, private repository contents, or credential-like
values in public reports. If an example is needed, reduce it to a minimal
reproduction that does not expose private data.

## Data Boundary

ForgeDesk does not call AI providers, upload repository contents, store API
keys, run background automation, commit, push, create pull requests, tag
releases, or publish packages. Release publishing is a maintainer action
outside the ForgeDesk CLI.
