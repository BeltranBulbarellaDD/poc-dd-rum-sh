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
