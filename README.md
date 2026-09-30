# Datadog RUM for Shopify

Proof of concept for configuring Datadog RUM through an embedded Shopify app.
Built on the Shopify React Router template with App Bridge and Polaris web components.

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

Required fields: `applicationId` (UUID), `clientToken`, and `site`. Optional fields:
`service`, `env`, `version`, `sessionSampleRate`, `sessionReplaySampleRate`,
`trackUserInteractions`, `trackResources`, `trackLongTasks`, and
`defaultPrivacyLevel`. Unknown options and JavaScript snippets are rejected.

Omitted collection values default to session sampling at 100%, Replay at 0%,
interaction/resource/long-task tracking enabled, and privacy level `mask`.
Setting `sessionReplaySampleRate` above 0 is an explicit opt-in to recording
sampled sessions. The application link uses the Datadog staging dashboard.

Supported sites: US1, US3, US5, EU1, AP1, AP2, UK1, and `datad0g.com` (staging).
The storefront integration is added separately; saving configuration alone does
not instrument the store.

See [Shopify React Router documentation](https://shopify.dev/docs/api/shopify-app-react-router)
for authentication and deployment guidance.
