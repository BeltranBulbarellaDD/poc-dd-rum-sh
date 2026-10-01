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

export const WEB_PIXEL_QUERY = `#graphql
  query RumWebPixel {
    webPixel {
      id
    }
  }
`;

export const WEB_PIXEL_CREATE_MUTATION = `#graphql
  mutation CreateRumWebPixel($webPixel: WebPixelInput!) {
    webPixelCreate(webPixel: $webPixel) {
      webPixel { id }
      userErrors { field message }
    }
  }
`;

export const WEB_PIXEL_UPDATE_MUTATION = `#graphql
  mutation UpdateRumWebPixel($id: ID!, $webPixel: WebPixelInput!) {
    webPixelUpdate(id: $id, webPixel: $webPixel) {
      webPixel { id }
      userErrors { field message }
    }
  }
`;

// Shopify returns an error instead of null when the app has no web pixel yet.
export async function readWebPixelId(admin: AdminApiContext) {
  try {
    const result = await (await admin.graphql(WEB_PIXEL_QUERY)).json();
    return (result.data?.webPixel?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveWebPixel(
  admin: AdminApiContext,
  id: string | null,
  config: RumConfig,
) {
  const webPixel = { settings: { rumConfig: JSON.stringify(config) } };
  const response = id
    ? await admin.graphql(WEB_PIXEL_UPDATE_MUTATION, {
        variables: { id, webPixel },
      })
    : await admin.graphql(WEB_PIXEL_CREATE_MUTATION, {
        variables: { webPixel },
      });
  const result = await response.json();
  const payload = id
    ? result.data?.webPixelUpdate
    : result.data?.webPixelCreate;
  if (("errors" in result && result.errors) || !payload?.webPixel) {
    throw new Error(
      payload?.userErrors
        ?.map((error: { message: string }) => error.message)
        .join(" ") || "Could not connect checkout tracking. Please retry.",
    );
  }
}
