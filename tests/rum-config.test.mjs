import assert from "node:assert/strict";
import { test } from "node:test";
import { DATADOG_SITES, parseRumConfig } from "../app/rum-config.ts";
import { readRumConfig, saveRumConfig } from "../app/rum-config.server.ts";

const input = {
  applicationId: "158f4f09-c41b-42ad-b6c5-b554f4159440",
  clientToken: "pub_test_token",
  site: "datadoghq.com",
};
const parse = (value) => parseRumConfig(JSON.stringify(value));

test("JSON configuration validates types, ranges, sites, and explicit replay", () => {
  const { config, errors } = parse(input);
  assert.deepEqual(errors, []);
  assert.equal(config.sessionReplaySampleRate, 0);
  assert.equal(config.defaultPrivacyLevel, "mask");
  assert.equal(
    parse({ ...input, sessionReplaySampleRate: 100 }).config
      .sessionReplaySampleRate,
    100,
  );
  assert.equal(
    parse({ ...input, sessionSampleRate: 0, sessionReplaySampleRate: 50 })
      .config.sessionSampleRate,
    0,
  );
  assert.equal(
    parse({ ...input, service: "  storefront  ", trackResources: false }).config
      .service,
    "storefront",
  );
  assert.equal(
    parse({ ...input, trackResources: false }).config.trackResources,
    false,
  );
  for (const site of Object.keys(DATADOG_SITES))
    assert.ok(parse({ ...input, site }).config);
  for (const invalid of [
    null,
    [],
    {},
    { ...input, applicationId: "bad" },
    { ...input, site: "datad0g.com.evil" },
    { ...input, site: "__proto__" },
    { ...input, clientToken: " " },
    { ...input, clientToken: "<script>" },
    { ...input, service: 12 },
    { ...input, sessionSampleRate: -1 },
    { ...input, sessionReplaySampleRate: 101 },
    { ...input, sessionSampleRate: "100" },
    { ...input, trackResources: "false" },
    { ...input, defaultPrivacyLevel: "other" },
    { ...input, defaultPrivacyLevel: { toString: null, valueOf: null } },
    { ...input, trackingConsent: "granted" },
    { ...input, ownerId: "another-store" },
  ]) {
    assert.equal(parse(invalid).config, null, JSON.stringify(invalid));
  }
  assert.equal(parseRumConfig("DD_RUM.init({})").config, null);
  assert.equal(parseRumConfig(" ").config, null);
  assert.equal(parseRumConfig("x".repeat(16385)).config, null);
});

test("persistence uses the authenticated installation and surfaces API failures", async () => {
  const calls = [];
  let failure = false;
  const config = parse(input).config;
  const admin = {
    graphql: async (query, options) => {
      calls.push({ query, options });
      return {
        json: async () =>
          failure
            ? {
                data: {
                  metafieldsSet: {
                    metafields: [],
                    userErrors: [{ message: "Rejected" }],
                  },
                },
              }
            : query.includes("query RumConfiguration")
              ? {
                  data: {
                    currentAppInstallation: {
                      id: "gid://shopify/AppInstallation/123",
                      rumConfig: { jsonValue: config },
                    },
                  },
                }
              : {
                  data: {
                    metafieldsSet: {
                      metafields: [{ id: "saved" }],
                      userErrors: [],
                    },
                  },
                },
      };
    },
  };
  const loaded = await readRumConfig(admin);
  await saveRumConfig(admin, loaded.installationId, config);
  assert.deepEqual(loaded.config, config);
  assert.deepEqual(calls[1].options.variables.metafields, [
    {
      ownerId: loaded.installationId,
      namespace: "datadog",
      key: "rum_config",
      type: "json",
      value: JSON.stringify(config),
    },
  ]);
  failure = true;
  await assert.rejects(
    saveRumConfig(admin, loaded.installationId, config),
    /could not|Could not/,
  );
  for (const result of [
    { errors: [{ message: "Failed" }] },
    { data: { currentAppInstallation: null } },
    {},
  ]) {
    const broken = { graphql: async () => ({ json: async () => result }) };
    await assert.rejects(readRumConfig(broken));
    await assert.rejects(saveRumConfig(broken, loaded.installationId, config));
  }
});
