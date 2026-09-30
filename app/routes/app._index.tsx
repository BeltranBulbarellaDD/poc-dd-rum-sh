import type {
  ActionFunctionArgs,
  ClientLoaderFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parseRumConfig } from "../rum-config";
import { readRumConfig, saveRumConfig } from "../rum-config.server";
import RumSetup from "../components/rum-setup";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const { config } = await readRumConfig(admin);
    return {
      configuration: config === null ? "" : JSON.stringify(config, null, 2),
      loadError: "",
    };
  } catch {
    return {
      configuration: "",
      loadError:
        "Could not load your configuration. Reload this page to try again.",
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  let configuration: unknown;
  try {
    configuration = (await request.formData()).get("configuration");
  } catch {
    return data(
      { saved: false, configuration: "", errors: ["Invalid form submission."] },
      { status: 400 },
    );
  }
  const parsed = parseRumConfig(
    typeof configuration === "string" ? configuration : "",
  );
  if (!parsed.config) {
    return data(
      { saved: false, configuration: "", errors: parsed.errors },
      { status: 400 },
    );
  }
  try {
    const { installationId } = await readRumConfig(admin);
    await saveRumConfig(admin, installationId, parsed.config);
    return {
      saved: true,
      configuration: JSON.stringify(parsed.config, null, 2),
      errors: [] as string[],
    };
  } catch {
    return data(
      {
        saved: false,
        configuration: "",
        errors: [
          "Could not confirm that the configuration was saved. Please retry.",
        ],
      },
      { status: 502 },
    );
  }
};

export default RumSetup;

export async function clientLoader({ serverLoader }: ClientLoaderFunctionArgs) {
  return serverLoader<typeof loader>();
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <s-page heading="RUM Setup">
      <s-spinner />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
