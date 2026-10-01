import { register } from "@shopify/web-pixels-extension";

// Feature branch build on the staging CDN (deploy-feature job, suffix "web-pixel")
const SDK_URL =
  "https://www.datad0g-browser-agent.com/datadog-rum-shopify-web-pixel-web-pixel.js";

register(({ analytics, browser, init, customerPrivacy, settings }) => {
  self.importScripts(SDK_URL);
  self.DD_RUM_WEB_PIXEL.init(JSON.parse(settings.rumConfig), {
    analytics,
    browser,
    init,
    customerPrivacy,
  });
});
