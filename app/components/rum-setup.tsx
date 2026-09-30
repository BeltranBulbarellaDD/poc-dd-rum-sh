import { useEffect, useState, type ReactNode } from "react";
import { DruidsEnvironment } from "@datadog/druids/layout/DruidsEnvironment";
import { TextArea } from "@datadog/druids/form/TextArea";
import { Button } from "@datadog/druids/form/Button";
import { StatusPill } from "@datadog/druids/pills/StatusPill";
import { Text } from "@datadog/druids/typography/Text";
import { RumIcon } from "@datadog/druids/icons/Rum";
import { ExternalLinkIcon } from "@datadog/druids/icons/ExternalLink";
import { CheckCircledIcon } from "@datadog/druids/icons/CheckCircled";
import "@datadog/druids/styles.css";
import { useFetcher, useLoaderData } from "react-router";
import type { action, loader } from "../routes/app._index";
import { parseRumConfig, rumApplicationUrl, rumListUrl } from "../rum-config";

const DOCS_URL = "https://docs.datadoghq.com/integrations/rum-shopify/";

const EMBED_HANDLE = "datadog-rum";

type EmbedStatus = "checking" | "active" | "available" | "unavailable";

function useEmbedStatus() {
  const [status, setStatus] = useState<EmbedStatus>("checking");
  useEffect(() => {
    shopify.app.extensions().then(
      (extensions) => {
        const embed = extensions
          .filter((extension) => extension.type === "theme_app_extension")
          .flatMap(
            (extension) =>
              extension.activations as { handle: string; status: string }[],
          )
          .find((activation) => activation.handle === EMBED_HANDLE);
        setStatus(
          embed?.status === "active"
            ? "active"
            : embed
              ? "available"
              : "unavailable",
        );
      },
      () => setStatus("unavailable"),
    );
  }, []);
  return status;
}

function openThemeEditor() {
  open(
    `shopify://admin/themes/current/editor?context=apps&activateAppId=${shopify.config.apiKey}/${EMBED_HANDLE}`,
    "_top",
  );
}

function Step({
  number,
  isDone,
  title,
  description,
  action,
  children,
}: {
  number: number;
  isDone: boolean;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <s-stack direction="block" gap="base">
      <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
        <s-grid gridTemplateColumns="24px 1fr" alignItems="center" gap="base">
          <span
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              border: isDone
                ? undefined
                : "1px solid var(--ui-border, #d0d0da)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isDone ? <CheckCircledIcon size="lg" level="success" /> : number}
          </span>
          <s-stack direction="block">
            <Text weight="bold">{title}</Text>
            <Text variant="secondary">{description}</Text>
          </s-stack>
        </s-grid>
        {action}
      </s-grid>
      {children}
    </s-stack>
  );
}

export default function RumSetup() {
  // Data
  const { configuration, loadError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;
  const saved = result?.saved ? result.configuration : configuration;
  const error = loadError || result?.errors.join(" ");
  const embedStatus = useEmbedStatus();

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
          <s-stack direction="block" gap="large">
            <s-grid
              gridTemplateColumns="1fr auto"
              alignItems="center"
              gap="base"
            >
              <s-grid
                gridTemplateColumns="auto 1fr"
                alignItems="center"
                gap="base"
              >
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
              </s-grid>
              <s-stack direction="inline" alignItems="center" gap="base">
                <s-link href={DOCS_URL} target="_blank">
                  Documentation
                </s-link>
                <Button
                  href={applicationUrl}
                  isExternal
                  isDisabled={!applicationUrl}
                  iconRight={ExternalLinkIcon}
                  isPrimary
                  label="Open in Datadog"
                />
              </s-stack>
            </s-grid>
            <s-divider />
            <Step
              number={1}
              isDone={!!saved}
              title="Add your RUM configuration"
              description={
                <>
                  Paste the JSON from your RUM application&apos;s setup page in
                  Datadog. Required: applicationId, clientToken, site.
                </>
              }
              action={
                <s-stack direction="inline" alignItems="center" gap="base">
                  {dirty && (
                    <StatusPill level="warning">Unsaved changes</StatusPill>
                  )}
                  <s-link href={rumListUrl(config?.site)} target="_blank">
                    Where do I find this?
                  </s-link>
                </s-stack>
              }
            >
              <TextArea
                id="rum-configuration"
                aria-label="RUM configuration JSON"
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
            </Step>
            <s-divider />
            <Step
              number={2}
              isDone={embedStatus === "active"}
              title="Turn on storefront tracking"
              description={
                embedStatus === "active"
                  ? "RUM is running on your online store."
                  : "Activate the Datadog RUM app embed in your theme. It loads the Browser SDK on every storefront page, with Session Replay."
              }
              action={
                <Button
                  onClick={openThemeEditor}
                  isDisabled={!saved || embedStatus === "checking"}
                  isPrimary={embedStatus !== "active"}
                  label={
                    embedStatus === "active" ? "Open theme editor" : "Activate"
                  }
                />
              }
            />
            <s-divider />
            <Step
              number={3}
              isDone={false}
              title="Track checkout"
              description="Capture checkout events with a Shopify web pixel. Session Replay isn't available on checkout pages."
              action={<StatusPill>Coming soon</StatusPill>}
            />
          </s-stack>
        </s-section>
      </s-page>
    </DruidsEnvironment>
  );
}
