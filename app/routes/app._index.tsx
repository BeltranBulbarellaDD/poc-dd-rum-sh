import type {
  ActionFunctionArgs,
  ClientLoaderFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parseRumConfig, parseTrackedEvents } from "../rum-config";
import {
  readRumConfig,
  readWebPixel,
  saveRumConfig,
  saveWebPixel,
} from "../rum-config.server";
import type { RumConfig } from "../rum-config";
import RumSetup from "../components/rum-setup";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const [{ config }, webPixel] = await Promise.all([
      readRumConfig(admin),
      readWebPixel(admin),
    ]);
    return {
      configuration: config === null ? "" : JSON.stringify(config, null, 2),
      checkoutConnected: webPixel !== null,
      trackedEvents: webPixel?.trackedEvents ?? parseTrackedEvents(undefined),
      loadError: "",
    };
  } catch {
    return {
      configuration: "",
      checkoutConnected: false,
      trackedEvents: parseTrackedEvents(undefined),
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
      const [{ config }, webPixel] = await Promise.all([
        readRumConfig(admin),
        readWebPixel(admin),
      ]);
      if (!config) throw new Error("Save your RUM configuration first.");
      await saveWebPixel(
        admin,
        webPixel?.id ?? null,
        config as RumConfig,
        webPixel?.trackedEvents ?? parseTrackedEvents(undefined),
      );
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
    const webPixel = await readWebPixel(admin);
    if (webPixel) {
      try {
        await saveWebPixel(
          admin,
          webPixel.id,
          parsed.config,
          form.has("trackedEvents")
            ? parseTrackedEvents(form.get("trackedEvents"))
            : webPixel.trackedEvents,
        );
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
