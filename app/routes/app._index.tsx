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
import {
  readRumConfig,
  readWebPixelId,
  saveRumConfig,
  saveWebPixel,
} from "../rum-config.server";
import type { RumConfig } from "../rum-config";
import RumSetup from "../components/rum-setup";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const [{ config }, webPixelId] = await Promise.all([
      readRumConfig(admin),
      readWebPixelId(admin),
    ]);
    return {
      configuration: config === null ? "" : JSON.stringify(config, null, 2),
      checkoutConnected: webPixelId !== null,
      loadError: "",
    };
  } catch {
    return {
      configuration: "",
      checkoutConnected: false,
      loadError:
        "Could not load your configuration. Reload this page to try again.",
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return data(
      { saved: false, configuration: "", errors: ["Invalid form submission."] },
      { status: 400 },
    );
  }
  if (form.get("intent") === "connect-checkout") {
    try {
      const [{ config }, webPixelId] = await Promise.all([
        readRumConfig(admin),
        readWebPixelId(admin),
      ]);
      if (!config) throw new Error("Save your RUM configuration first.");
      await saveWebPixel(admin, webPixelId, config as RumConfig);
      return { saved: false, configuration: "", errors: [] as string[] };
    } catch (error) {
      return data(
        {
          saved: false,
          configuration: "",
          errors: [(error as Error).message],
        },
        { status: 502 },
      );
    }
  }
  const configuration = form.get("configuration");
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
    const errors: string[] = [];
    const webPixelId = await readWebPixelId(admin);
    if (webPixelId) {
      try {
        await saveWebPixel(admin, webPixelId, parsed.config);
      } catch {
        errors.push(
          "Configuration saved, but checkout tracking could not be updated.",
        );
      }
    }
    return {
      saved: true,
      configuration: JSON.stringify(parsed.config, null, 2),
      errors,
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
