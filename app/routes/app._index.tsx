import { useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { parseRumConfig, RUM_DEFAULTS } from "../rum-config";
import { readRumConfig, saveRumConfig } from "../rum-config.server";

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

const EXAMPLE = JSON.stringify(
  {
    applicationId: "YOUR_APPLICATION_ID",
    clientToken: "YOUR_CLIENT_TOKEN",
    site: "datadoghq.com",
    service: "shopify-storefront",
    env: "production",
    ...RUM_DEFAULTS,
  },
  null,
  2,
);

export default function Index() {
  const { configuration, loadError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [configurationText, setConfigurationText] = useState(configuration);
  const configurationField = useRef<HTMLElementTagNameMap["s-text-area"]>(null);
  const isSaving = fetcher.state !== "idle";
  const parsed = parseRumConfig(configurationText);
  const config = parsed.config;
  const savedConfiguration = fetcher.data?.saved
    ? fetcher.data.configuration
    : configuration;
  const dirty = configurationText !== savedConfiguration;

  useEffect(() => {
    if (fetcher.data?.saved) setConfigurationText(fetcher.data.configuration);
  }, [fetcher.data]);

  useEffect(() => {
    if (configurationField.current)
      configurationField.current.value = configurationText;
  }, [configurationText]);

  const save = () =>
    fetcher.submit({ configuration: configurationText }, { method: "post" });
  const errors = fetcher.data && !fetcher.data.saved ? fetcher.data.errors : [];

  return (
    <s-page heading="RUM Setup">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={save}
        disabled={isSaving || !config || !dirty || !!loadError}
        loading={isSaving}
      >
        Save
      </s-button>

      {loadError && (
        <s-banner tone="critical" heading="Configuration unavailable">
          {loadError}
        </s-banner>
      )}
      {errors.length > 0 && (
        <s-banner tone="critical" heading="Configuration not saved">
          {errors.join(" ")}
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="large">
          <s-stack
            direction="inline"
            justifyContent="space-between"
            alignItems="center"
          >
            <s-heading>Start here</s-heading>
            <s-button
              href={
                config
                  ? `https://dd.datad0g.com/rum/application/${config.applicationId}`
                  : undefined
              }
              target="_blank"
              disabled={!config}
            >
              Open RUM application
            </s-button>
          </s-stack>
          <s-paragraph>
            Paste your Datadog configuration to set up monitoring for this
            store.
          </s-paragraph>
          <s-text-area
            ref={configurationField}
            label="Paste Datadog configuration (JSON)"
            details="Use the configuration object from Datadog, without DD_RUM.init() or script tags. Application ID, client token, and site are required."
            value={configurationText}
            rows={14}
            maxLength={16384}
            autocomplete="off"
            disabled={isSaving || !!loadError}
            onInput={(event) => setConfigurationText(event.currentTarget.value)}
            error={
              configurationText.trim() && !config
                ? parsed.errors.join(" ")
                : undefined
            }
            placeholder={EXAMPLE}
          />
          <details>
            <summary>View example configuration</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {EXAMPLE}
            </pre>
          </details>
          <s-paragraph color="subdued">
            Session Replay is off unless you explicitly set
            sessionReplaySampleRate above 0. Supported sites: US1, US3, US5,
            EU1, AP1, AP2, UK1, and Datadog staging.
          </s-paragraph>
        </s-stack>
      </s-section>

      {config && (
        <s-section heading="Configuration preview">
          <s-table>
            <s-table-header-row>
              <s-table-header>Setting</s-table-header>
              <s-table-header>Value</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {Object.entries(config)
                .filter(([key]) => key !== "clientToken")
                .map(([key, value]) => (
                  <s-table-row key={key}>
                    <s-table-cell>{key}</s-table-cell>
                    <s-table-cell>{String(value)}</s-table-cell>
                  </s-table-row>
                ))}
              <s-table-row>
                <s-table-cell>clientToken</s-table-cell>
                <s-table-cell>Provided</s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-section heading="Status">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text>Configuration</s-text>
            <s-badge tone={savedConfiguration ? "success" : "neutral"}>
              {savedConfiguration ? "Configuration saved" : "Not saved"}
            </s-badge>
            {dirty && <s-badge tone="warning">Unsaved changes</s-badge>}
          </s-stack>
          <s-paragraph>Storefront integration not configured.</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
