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
yarn build
shopify app config validate --json
```

## Configuration

`shopify.app.toml` defines the app identity, URLs, scopes, and lifecycle webhooks.
Development URLs are updated automatically by Shopify CLI. The app currently
requests no resource access scopes.

The product creation demo, product metafield, example metaobject, and additional
demo page have been removed. Authentication, session storage, and lifecycle
webhooks remain in place.

See [Shopify React Router documentation](https://shopify.dev/docs/api/shopify-app-react-router)
for authentication and deployment guidance.
