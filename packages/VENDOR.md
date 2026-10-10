# Vendored Morphos packages

CaptureApp is a standalone public repo. It cannot `file:`-depend on private Morphos-Workspace.

| Package | Role in this repo | Morphos |
|---------|-------------------|---------|
| `mobile-i18n` | **SSOT** (moved; Capture is the only consumer) | Deleted from Morphos after this extract |
| `mobile-preprocess` | Snapshot copy | Morphos `packages/mobile-preprocess` remains SSOT (PortalAPI validates sidecars) |
| `portal-api-client` | Snapshot copy | Morphos `packages/portal-api-client` remains SSOT (AthletePortal + PortalAPI) |

Source Morphos-Workspace commit for the two snapshots: `9af68bc689fb84bdc0aaf454cf76306f503d257e`

## `@morphos/entra-auth` is not here

The Morphos `portal-api-client` imports two header **names** from `@morphos/entra-auth/headers`:

- `x-morphos-portal-user-bearer`
- `x-morphos-upload-ticket`

This copy inlines those strings in `portal-api-client/src/fetch.ts` and `upload.ts`. Do **not** vendor `entra-auth` (MSAL Node, MySQL Entra, JWT, managed identity).

## Resync

When Morphos changes `mobile-preprocess` or `portal-api-client`:

1. Copy the Morphos package tree (exclude `node_modules`, `dist`).
2. Re-apply the header-inline patch and drop `@morphos/entra-auth` from this `portal-api-client/package.json`.
3. Update the SHA above.
4. `npm install` at the repo root and re-run `npm test`.
