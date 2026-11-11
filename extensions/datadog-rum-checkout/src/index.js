// // Run yarn dev in browser-sdk. Update the port if the dev server uses another one.
// self.importScripts("http://localhost:8080/datadog-rum-shopify.js");
// self.DD_RUM._setDebug(true); // Log SDK internal errors to the worker console

// // What `register` from @shopify/web-pixels-extension does. Must run synchronously at the top level.
// self.shopify.extend("WebPixel::Render", ({ analytics, settings }) => {
//   let rumConfig;
//   try {
//     rumConfig = JSON.parse(settings.rumConfig);
//   } catch {
//     console.error("Datadog RUM: the rumConfig pixel setting must contain a JSON object");
//     return;
//   }

//   // The plugin forces the worker configuration (manual views, memory session, no view metrics…)
//   self.DD_RUM.init({ ...rumConfig, plugins: [self.DD_RUM.shopifyAppPixelPlugin()] });

//   // In the worker, `location` is the pixel script URL: take the page URL from Shopify instead
//   analytics.subscribe("page_viewed", (event) => {
//     self.DD_RUM.startView({ url: event.context.document.location.href });
//   });
// });

// Run yarn dev in browser-sdk. Update the port if the dev server uses another one.
// self.importScripts("http://localhost:8080/datadog-rum-shopify.js");
// self.DD_RUM._setDebug(true); // Log SDK internal errors to the worker console
// self.DD_RUM.init({ plugins: [self.DD_RUM.shopifyAppPixelPlugin()] });

self.importScripts("https://www.datadoghq-browser-agent.com/us1/v7/datadog-rum-shopify.js");
self.DD_RUM._setDebug(true);
self.DD_RUM.init({ plugins: [self.DD_RUM.shopifyAppPixelPlugin()] });