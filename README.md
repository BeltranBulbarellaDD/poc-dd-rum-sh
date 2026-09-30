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

## Storefront embed

The `extensions/datadog-rum` theme app embed reads the installation metafield
and loads Datadog's Shopify RUM v7 bundle from the CDN for the selected site.
Staging uses the separate `datadog-rum-shopify-staging.js` bundle.
Configuration is serialized as escaped JSON data, never executed as JavaScript.

Preview the extension with `shopify app dev`, or deploy it with `shopify app deploy`.
After saving the RUM configuration, click **Enable on storefront**, enable the
embed in the theme editor, and save the theme. **Refresh status** checks the
published theme via App Bridge; it does not verify Datadog ingestion.
Saving configuration alone does not instrument the store. The app never writes
theme settings files and needs no theme access scopes.

The SDK starts with tracking denied until Shopify's Customer Privacy API allows
analytics processing, then follows `visitorConsentCollected` changes. If the
privacy API fails, tracking remains denied. Replay sampling still requires an
explicit configuration value above zero. The embed skips theme editor previews
and an already-present `DD_RUM` instance. Checkout/Web Pixel integration is not
part of this PoC.

Before rollout, verify in a development store: save/reload configuration, enable
and save the embed, refresh its status, and visit the live storefront with
analytics consent denied, granted, and revoked. Confirm the correct CDN request
and RUM events in the configured Datadog application (including Replay only
when opted in), and ensure disabling the embed stops instrumentation on reload.

See [Shopify React Router documentation](https://shopify.dev/docs/api/shopify-app-react-router)
for authentication and deployment guidance.
