export const DATADOG_SITES = {
  "datadoghq.com": "us1",
  "us3.datadoghq.com": "us3",
  "us5.datadoghq.com": "us5",
  "datadoghq.eu": "eu1",
  "ap1.datadoghq.com": "ap1",
  "ap2.datadoghq.com": "ap2",
  "uk1.datadoghq.com": "uk1",
  "datad0g.com": "staging",
} as const;

export type RumConfig = {
  applicationId: string;
  clientToken: string;
  site: keyof typeof DATADOG_SITES;
  service?: string;
  env?: string;
  version?: string;
  sessionSampleRate: number;
  sessionReplaySampleRate: number;
  trackUserInteractions: boolean;
  trackResources: boolean;
  trackLongTasks: boolean;
  defaultPrivacyLevel: "mask" | "mask-user-input" | "allow";
};

export const RUM_DEFAULTS = {
  sessionSampleRate: 100,
  sessionReplaySampleRate: 0,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: "mask",
} satisfies Partial<RumConfig>;

export function parseRumConfig(text: string): {
  config: RumConfig | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (text.length > 16384) {
    return { config: null, errors: ["Configuration must be at most 16 KB."] };
  }

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Not an object");
    }
  } catch {
    return {
      config: null,
      errors: ["Paste a JSON object, not a JavaScript snippet."],
    };
  }

  const config = { ...RUM_DEFAULTS } as RumConfig;
  const allowed = [
    "applicationId",
    "clientToken",
    "site",
    "service",
    "env",
    "version",
    ...Object.keys(RUM_DEFAULTS),
  ];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors.push(`${key}: unsupported option.`);
  }

  for (const key of ["applicationId", "clientToken", "site"] as const) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      errors.push(`${key}: required.`);
    } else {
      // Assignment is validated below before the configuration can be returned.
      Object.assign(config, { [key]: input[key].trim() });
    }
  }
  if (
    config.applicationId &&
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(config.applicationId)
  ) {
    errors.push("applicationId: enter a valid UUID.");
  }
  if (
    config.clientToken &&
    (!/^[\w-]+$/.test(config.clientToken) || config.clientToken.length > 256)
  ) {
    errors.push("clientToken: enter a valid Datadog client token.");
  }
  if (config.site && !Object.hasOwn(DATADOG_SITES, config.site)) {
    errors.push(`site: choose ${Object.keys(DATADOG_SITES).join(", ")}.`);
  }

  for (const key of ["service", "env", "version"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string" || input[key].length > 200) {
      errors.push(`${key}: enter a string of at most 200 characters.`);
    } else if (input[key].trim()) {
      config[key] = input[key].trim();
    }
  }
  for (const key of ["sessionSampleRate", "sessionReplaySampleRate"] as const) {
    if (input[key] === undefined) continue;
    const value = input[key];
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      errors.push(`${key}: enter a number between 0 and 100.`);
    } else config[key] = value;
  }
  for (const key of [
    "trackUserInteractions",
    "trackResources",
    "trackLongTasks",
  ] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean")
      errors.push(`${key}: enter true or false.`);
    else config[key] = input[key];
  }
  if (input.defaultPrivacyLevel !== undefined) {
    if (
      typeof input.defaultPrivacyLevel !== "string" ||
      !["mask", "mask-user-input", "allow"].includes(input.defaultPrivacyLevel)
    ) {
      errors.push(
        "defaultPrivacyLevel: choose mask, mask-user-input, or allow.",
      );
    } else
      config.defaultPrivacyLevel =
        input.defaultPrivacyLevel as RumConfig["defaultPrivacyLevel"];
  }
  return { config: errors.length ? null : config, errors };
}
