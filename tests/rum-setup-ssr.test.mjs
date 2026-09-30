import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";
import * as rumConfig from "../app/rum-config.ts";

test("RUM setup renders on the server without accessing browser-only App Bridge APIs", () => {
  const require = createRequire(import.meta.url);
  const source = readFileSync(
    new URL("../app/routes/app._index.tsx", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      if (name === "react-router")
        return {
          useLoaderData: () => ({ configuration: "", loadError: "" }),
          useFetcher: () => ({ state: "idle" }),
        };
      if (name === "../rum-config") return rumConfig;
      if (
        name === "../shopify.server" ||
        name === "../rum-config.server" ||
        name === "@shopify/shopify-app-react-router/server"
      )
        return {};
      // Use the actual App Bridge hook: its SSR proxy throws on any API access.
      return require(name);
    },
  });
  const html = renderToString(createElement(exports.default));
  assert.match(html, /RUM Setup/);
  assert.match(html, /Checking storefront embed/);
  assert.match(html, /<s-button[^>]*disabled="true"[^>]*>Enable on storefront/);
  assert.doesNotMatch(html, /activateAppId=/);
});
