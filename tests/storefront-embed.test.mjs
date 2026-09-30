import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { DATADOG_SITES, parseRumConfig } from "../app/rum-config.ts";

const asset = readFileSync(
  new URL("../extensions/datadog-rum/assets/datadog-rum.js", import.meta.url),
  "utf8",
);
const config = parseRumConfig(
  JSON.stringify({
    applicationId: "158f4f09-c41b-42ad-b6c5-b554f4159440",
    clientToken: "pub_test_token",
    site: "datadoghq.com",
    service: '</script><script>alert("unsafe")</script>',
  }),
).config;

function storefront({
  content = JSON.stringify(config),
  allowed = false,
  privacyError = false,
  existingRum,
  designMode = false,
  loading = false,
} = {}) {
  const scripts = [],
    inits = [],
    consents = [],
    warnings = [],
    listeners = new Map();
  let privacyCallback;
  const window = {
    Shopify: {
      designMode,
      customerPrivacy: { analyticsProcessingAllowed: () => allowed },
      loadFeatures: (_, callback) => {
        privacyCallback = callback;
      },
    },
    ...(existingRum ? { DD_RUM: existingRum } : {}),
  };
  const document = {
    readyState: loading ? "loading" : "complete",
    querySelector: () => (content === null ? null : { content }),
    addEventListener: (name, listener) => listeners.set(name, listener),
    createElement: () => ({}),
    head: { appendChild: (script) => scripts.push(script) },
  };
  const evaluate = () =>
    runInNewContext(asset, {
      window,
      document,
      console: { warn: (message) => warnings.push(message) },
    });
  const fire = (event) => listeners.get(event)?.();
  evaluate();
  if (loading) {
    document.readyState = "complete";
    fire("DOMContentLoaded");
  }
  return {
    scripts,
    inits,
    consents,
    warnings,
    window,
    fire,
    evaluate,
    privacyLoaded: () =>
      privacyCallback?.(privacyError ? new Error("Unavailable") : undefined),
    setAllowed: (value) => {
      allowed = value;
      fire("visitorConsentCollected");
    },
    sdkLoaded: () => {
      const rum = window.DD_RUM;
      const queue = [...rum.q];
      // The SDK replaces the bootstrap object, rather than mutating it.
      window.DD_RUM = {
        onReady: (callback) => callback(),
        init: (value) => inits.push(value),
        setTrackingConsent: (value) => consents.push(value),
      };
      for (const callback of queue) callback();
    },
  };
}

test("storefront initializes once, uses safe CDN mapping, and preserves configuration", () => {
  for (const [site, region] of Object.entries(DATADOG_SITES)) {
    const page = storefront({
      content: JSON.stringify({ ...config, site }),
      loading: true,
    });
    const expected =
      region === "staging"
        ? "https://www.datad0g-browser-agent.com/datadog-rum-shopify-staging.js"
        : `https://www.datadoghq-browser-agent.com/${region}/v7/datadog-rum-shopify.js`;
    assert.equal(page.scripts[0].src, expected);
    assert.equal(page.scripts[0].crossOrigin, "anonymous");
    page.evaluate();
    assert.equal(page.scripts.length, 1);
    page.sdkLoaded();
    assert.equal(page.inits.length, 1);
    assert.equal(page.inits[0].service, config.service);
    assert.equal(page.inits[0].sessionReplaySampleRate, 0);
    assert.equal(page.inits[0].trackingConsent, "not-granted");
  }
});

test("Shopify consent starts closed and handles grant, revocation, and SDK load races", () => {
  const page = storefront();
  page.sdkLoaded();
  assert.equal(page.inits[0].trackingConsent, "not-granted");
  page.privacyLoaded();
  page.setAllowed(true);
  page.setAllowed(false);
  assert.deepEqual(page.consents, ["not-granted", "granted", "not-granted"]);

  const delayed = storefront({ allowed: true });
  delayed.privacyLoaded();
  delayed.setAllowed(false);
  delayed.sdkLoaded();
  assert.equal(delayed.inits[0].trackingConsent, "not-granted");
  assert.ok(delayed.consents.every((value) => value === "not-granted"));

  const failed = storefront({ allowed: true, privacyError: true });
  failed.privacyLoaded();
  failed.sdkLoaded();
  failed.setAllowed(true);
  assert.equal(failed.inits[0].trackingConsent, "not-granted");
  assert.deepEqual(failed.consents, ["not-granted"]);
  assert.equal(failed.warnings.length, 1);
});

test("missing/malformed configuration, design mode, or existing RUM do not initialize", () => {
  for (const options of [
    { content: null },
    { content: "broken" },
    { content: "null" },
    { content: "{}" },
    { content: JSON.stringify({ ...config, site: "__proto__" }) },
    { designMode: true },
    { existingRum: { existing: true } },
  ]) {
    const page = storefront(options);
    assert.equal(page.scripts.length, 0);
    assert.equal(page.inits.length, 0);
  }
  const liquid = readFileSync(
    new URL(
      "../extensions/datadog-rum/blocks/datadog-rum.liquid",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(liquid, /rum_config \| json \| escape/);
  assert.match(liquid, /request.design_mode == false/);
});
