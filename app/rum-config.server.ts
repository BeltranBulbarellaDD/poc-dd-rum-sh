import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { RumConfig } from "./rum-config";

export const RUM_CONFIG_QUERY = `#graphql
  query RumConfiguration {
    currentAppInstallation {
      id
      rumConfig: metafield(namespace: "datadog", key: "rum_config") {
        jsonValue
      }
    }
  }
`;

export const RUM_CONFIG_MUTATION = `#graphql
  mutation SaveRumConfiguration($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

export async function readRumConfig(admin: AdminApiContext) {
  const response = await admin.graphql(RUM_CONFIG_QUERY);
  const result = await response.json();
  const installation = result.data?.currentAppInstallation;
  if (("errors" in result && result.errors) || !installation?.id) {
    throw new Error(
      "Could not load the store's RUM configuration. Please retry.",
    );
  }
  return {
    installationId: installation.id as string,
    config: (installation.rumConfig?.jsonValue ?? null) as unknown,
  };
}

export async function saveRumConfig(
  admin: AdminApiContext,
  installationId: string,
  config: RumConfig,
) {
  const response = await admin.graphql(RUM_CONFIG_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: installationId,
          namespace: "datadog",
          key: "rum_config",
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  });
  const result = await response.json();
  if (
    ("errors" in result && result.errors) ||
    !result.data?.metafieldsSet ||
    result.data.metafieldsSet.userErrors?.length ||
    !result.data.metafieldsSet.metafields?.length
  ) {
    throw new Error(
      "Could not confirm that the configuration was saved. Please retry.",
    );
  }
}
