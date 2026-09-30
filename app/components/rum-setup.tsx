import { useEffect, useState } from "react";
import { DruidsEnvironment } from "@datadog/druids/layout/DruidsEnvironment";
import { TextArea } from "@datadog/druids/form/TextArea";
import { Button } from "@datadog/druids/form/Button";
import { StatusPill } from "@datadog/druids/pills/StatusPill";
import { Text } from "@datadog/druids/typography/Text";
import { RumIcon } from "@datadog/druids/icons/Rum";
import { ExternalLinkIcon } from "@datadog/druids/icons/ExternalLink";
import "@datadog/druids/styles.css";
import { useFetcher, useLoaderData } from "react-router";
import type { action, loader } from "../routes/app._index";
import { parseRumConfig, rumApplicationUrl } from "../rum-config";

export default function RumSetup() {
  // Data
  const { configuration, loadError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;
  const saved = result?.saved ? result.configuration : configuration;
  const error = loadError || result?.errors.join(" ");

  // State
  const [text, setText] = useState(configuration);
  const saving = fetcher.state !== "idle";
  const dirty = text !== saved;

  // Config
  const { config, errors } = parseRumConfig(text);
  const applicationUrl = rumApplicationUrl(config);

  useEffect(() => {
    if (result?.saved) setText(result.configuration);
  }, [result]);

  return (
    <DruidsEnvironment>
      <s-page heading="RUM Setup">
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() =>
            fetcher.submit({ configuration: text }, { method: "post" })
          }
          disabled={saving || !config || !dirty || !!loadError}
          loading={saving}
        >
          Save
        </s-button>
        {error && <s-banner tone="critical">{error}</s-banner>}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignItems="center"
              gap="base"
            >
              <s-stack direction="inline" alignItems="center" gap="base">
                <RumIcon
                  size="xl"
                  style={{ color: "var(--ui-brand, #632ca6)" }}
                />
                <s-stack direction="block">
                  <Text size="lg" weight="bold">
                    Datadog RUM
                  </Text>
                  <Text variant="secondary">
                    Monitor real user sessions on your storefront and checkout.
                  </Text>
                </s-stack>
              </s-stack>
              <StatusPill level={saved ? "success" : "default"}>
                {saved ? "Configured" : "Not configured"}
              </StatusPill>
            </s-stack>
            <s-divider />
            <s-stack direction="block" gap="small-200">
              <label htmlFor="rum-configuration">
                <Text weight="bold">Configuration</Text>
              </label>
              <Text variant="secondary">
                Paste the JSON from your RUM application's setup page in
                Datadog. Required: applicationId, clientToken, site.
              </Text>
            </s-stack>
            <TextArea
              id="rum-configuration"
              value={text}
              defaultRows={14}
              isFullWidth
              isMonospace
              maxLength={16384}
              autoComplete="off"
              isDisabled={saving || !!loadError}
              onChange={(event) => setText(event.currentTarget.value)}
            />
            {dirty && text.trim() && !config && (
              <s-banner tone="critical" heading="Invalid configuration">
                {errors.join(" ")}
              </s-banner>
            )}
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignItems="center"
            >
              {dirty ? (
                <StatusPill level="warning">Unsaved changes</StatusPill>
              ) : (
                <span />
              )}
              <Button
                href={applicationUrl}
                isExternal
                isDisabled={!applicationUrl}
                iconRight={ExternalLinkIcon}
                isPrimary
                level="featured"
                label="Open in Datadog"
              />
            </s-stack>
          </s-stack>
        </s-section>
      </s-page>
    </DruidsEnvironment>
  );
}
