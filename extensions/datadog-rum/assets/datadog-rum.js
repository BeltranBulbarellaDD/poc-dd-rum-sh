(() => {
  function initialize() {
    const element = document.querySelector('meta[name="datadog-rum-config"]');
    if (
      !element ||
      window.Shopify?.designMode ||
      window.__datadogShopifyRumStarted
    )
      return;
    if (window.DD_RUM) {
      console.warn(
        "[Datadog Shopify] RUM already exists; skipping the app embed.",
      );
      return;
    }

    let config;
    try {
      config = JSON.parse(element.content);
    } catch {
      console.warn("[Datadog Shopify] Invalid RUM configuration.");
      return;
    }
    const regions = {
      "datadoghq.com": "us1",
      "us3.datadoghq.com": "us3",
      "us5.datadoghq.com": "us5",
      "datadoghq.eu": "eu1",
      "ap1.datadoghq.com": "ap1",
      "ap2.datadoghq.com": "ap2",
      "uk1.datadoghq.com": "uk1",
      "datad0g.com": "staging",
    };
    if (
      !config ||
      typeof config.applicationId !== "string" ||
      !config.applicationId ||
      typeof config.clientToken !== "string" ||
      !config.clientToken ||
      typeof config.site !== "string" ||
      !Object.hasOwn(regions, config.site)
    )
      return;

    window.__datadogShopifyRumStarted = true;
    window.DD_RUM = {
      q: [],
      onReady(callback) {
        this.q.push(callback);
      },
    };
    let privacyReady = false;
    function trackingConsent() {
      try {
        return privacyReady &&
          window.Shopify?.customerPrivacy?.analyticsProcessingAllowed() === true
          ? "granted"
          : "not-granted";
      } catch {
        return "not-granted";
      }
    }
    const syncConsent = () =>
      window.DD_RUM.onReady(() =>
        window.DD_RUM.setTrackingConsent(trackingConsent()),
      );
    window.DD_RUM.onReady(() =>
      window.DD_RUM.init({ ...config, trackingConsent: trackingConsent() }),
    );
    document.addEventListener("visitorConsentCollected", syncConsent);

    if (typeof window.Shopify?.loadFeatures === "function") {
      window.Shopify.loadFeatures(
        [{ name: "consent-tracking-api", version: "0.1" }],
        (error) => {
          if (error) {
            console.warn(
              "[Datadog Shopify] Consent API unavailable; tracking remains disabled.",
            );
            return;
          }
          privacyReady = true;
          syncConsent();
        },
      );
    } else {
      console.warn(
        "[Datadog Shopify] Consent API unavailable; tracking remains disabled.",
      );
    }

    const script = document.createElement("script");
    script.src =
      config.site === "datad0g.com"
        ? "https://www.datad0g-browser-agent.com/datadog-rum-shopify-staging.js"
        : `https://www.datadoghq-browser-agent.com/${regions[config.site]}/v7/datadog-rum-shopify.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () =>
      console.warn("[Datadog Shopify] RUM SDK could not be loaded.");
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else initialize();
})();
