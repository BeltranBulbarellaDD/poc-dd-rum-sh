import {
  validateAndBuildConfiguration,
  type InferredConfig,
} from "@datadog/js-core/configuration";
import {
  INTAKE_SITE_US1,
  INTAKE_SITE_EU1,
  INTAKE_SITE_STAGING,
  INTAKE_SITE_US1_FED,
  type Site,
} from "@datadog/js-core/transport";
import { originalConsoleMethods } from "@datadog/js-core/util";

const schema = {
  applicationId: { type: "string", required: true },
  clientToken: { type: "string", required: true },
  site: { type: "site", required: true },
  sessionReplaySampleRate: { type: "percentage", default: 0 },
  defaultPrivacyLevel: {
    type: "enum",
    values: ["mask", "mask-user-input", "allow"],
    default: "mask",
  },
} as const;

export type RumConfig = InferredConfig<typeof schema> & Record<string, unknown>;

function appHost(site: Site) {
  switch (site) {
    case INTAKE_SITE_STAGING:
      return `dd.${site}`;
    case INTAKE_SITE_US1:
    case INTAKE_SITE_EU1:
    case INTAKE_SITE_US1_FED:
      return `app.${site}`;
    default:
      return site;
  }
}

export function rumApplicationUrl(config: RumConfig | null) {
  if (!config) return undefined;
  try {
    return new URL(
      `/rum/application/${encodeURIComponent(config.applicationId)}`,
      `https://${appHost(config.site)}`,
    ).href;
  } catch {
    return undefined;
  }
}

export function rumListUrl(site: Site = INTAKE_SITE_US1) {
  return `https://${appHost(site)}/rum/list`;
}

// Shopify events the checkout web pixel can turn into RUM events, by RUM event type. Mirrors
// `shopifyAppPixelPlugin` in the Browser SDK.
// https://shopify.dev/docs/api/web-pixels-api/standard-events
// https://shopify.dev/docs/api/web-pixels-api/dom-events
export const CHECKOUT_EVENTS = [
  { rumType: "Views", events: ["page_viewed"] },
  {
    rumType: "Actions",
    events: [
      "clicked",
      "checkout_started",
      "checkout_contact_info_submitted",
      "checkout_address_info_submitted",
      "checkout_shipping_info_submitted",
      "payment_info_submitted",
      "checkout_completed",
      "alert_displayed",
      "form_submitted",
      "input_focused",
      "input_blurred",
      "input_changed",
    ],
  },
  { rumType: "Errors", events: ["ui_extension_errored"] },
];

// Always collected by the pixel, whatever the selection.
export const ALWAYS_TRACKED_EVENTS = ["page_viewed", "ui_extension_errored"];

const OPTIONAL_EVENTS = CHECKOUT_EVENTS.flatMap(({ events }) => events).filter(
  (event) => !ALWAYS_TRACKED_EVENTS.includes(event),
);

// Collected when the pixel `trackedEvents` setting is not set. The form and input events fire often.
const DEFAULT_TRACKED_EVENTS = OPTIONAL_EVENTS.filter(
  (event) =>
    ![
      "form_submitted",
      "input_focused",
      "input_blurred",
      "input_changed",
    ].includes(event),
);

/**
 * Parses the comma-separated pixel `trackedEvents` setting, dropping unknown events (like the
 * "none" marker of an empty selection). A missing or blank setting means the defaults.
 */
export function parseTrackedEvents(setting: unknown): string[] {
  return typeof setting === "string" && setting.trim()
    ? setting.split(",").filter((event) => OPTIONAL_EVENTS.includes(event))
    : DEFAULT_TRACKED_EVENTS;
}

export function parseRumConfig(text: string): {
  config: RumConfig | null;
  errors: string[];
} {
  if (text.length > 16384)
    return { config: null, errors: ["Configuration must be at most 16 KB."] };
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    return { config: null, errors: ["Enter valid JSON."] };
  }
  for (const key of ["applicationId", "clientToken", "site"])
    if (typeof config?.[key] === "string") config[key] = config[key].trim();
  const errors: string[] = [];
  const validated = validateAndBuildConfiguration(config, schema, {
    ...originalConsoleMethods,
    error: (message) => errors.push(String(message)),
  });
  return {
    config: validated ? { ...config, ...validated } : null,
    errors,
  };
}
