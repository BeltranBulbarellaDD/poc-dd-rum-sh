# Datadog RUM for Shopify

Proof of concept for configuring Datadog RUM through an embedded Shopify app.
Built on the Shopify React Router template with App Bridge, a Polaris app shell,
and Datadog Druids form components.

## Development

Requires Node.js 22.12+ and [Shopify CLI](https://shopify.dev/docs/api/shopify-cli).

```sh
yarn install
yarn dev
```

Shopify CLI supplies the app environment, creates the development tunnel, and
prepares the Prisma SQLite database. Prisma stores Shopify authentication sessions.

## Checks

```sh
yarn typecheck
yarn lint
yarn test
yarn build
shopify app config validate --json
```

## Configuration

`shopify.app.toml` defines the app identity, URLs, scopes, and lifecycle webhooks.
Development URLs are updated automatically by Shopify CLI. The app currently
requests no resource access scopes.

## RUM setup

Open the embedded app, paste a JSON configuration object, and save it. The app
validates the values on the server and stores them in the `datadog.rum_config`
JSON app-data metafield on the authenticated store's `AppInstallation`.
Prisma continues to store authentication sessions only.

Required fields: `applicationId`, `clientToken`, and `site`. A small schema using
`@datadog/js-core/configuration` checks these fields, Replay sampling, and privacy
level. Other JSON SDK options are preserved and left to the RUM SDK to interpret;
JavaScript snippets are never evaluated. This is not full SDK validation.

Omitted Replay sampling defaults to 0% and privacy level to `mask`.
Setting `sessionReplaySampleRate` above 0 is an explicit opt-in to recording
sampled sessions. The application link uses the configured Datadog site.

Intake constants come from `@datadog/js-core/transport`, including `datad0g.com`
(staging). The app uses the SDK's `Site` type directly.
The storefront integration is added separately; saving configuration alone does
not instrument the store.

The UI lives in `app/components/rum-setup.tsx`; the route owns authentication,
loading, and saving. Druids renders after hydration because its environment
requires browser APIs; React Router's `clientLoader` and `HydrateFallback` handle
this without a mounted flag. The Datadog packages are pinned: `js-core` is an internal
SDK package with unstable APIs; Druids use in this PoC was confirmed by the owner.

See [Shopify React Router documentation](https://shopify.dev/docs/api/shopify-app-react-router)
for authentication and deployment guidance.
