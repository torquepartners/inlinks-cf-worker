/**
 * This Cloudflare Worker allow you to integrate functionality
 * from https://inlinks.net/ to dynamically add internal linking
 * and JSON+LD schema to your website. All changes are injected
 * "on the edge", meaning that they appear to crawlers as if they
 * had been added server-side on the origin server.
 */

// EDIT HERE.
const INLINKS_PID = "";

/**
 * Helper method to fetch configuration data from the InLinks service.
 * @param {string} configKey - The configuration key for the current URL.
 * @return {Array} rules - An array of configuration rules.
 */
async function getUrlConfig(configKey) {
  const config = await fetch(
    `https://jscloud.net/x/${INLINKS_PID}/${configKey}.json`
  );
  return config.ok ? await config.json() : new Array();
}

/**
 * Returns a HTMLRewriter ElementHandler class for internal linking injection.
 * @param {array} urlConfig - The array of configuration rules.
 * @return {ElementHandler} - The ElementHandler class.
 */
function getContentHandler(urlConfig) {
  class ElementHandler {
    text(text) {
      let textBlock = text.text;
      urlConfig.forEach((configRule) => {
        textBlock = textBlock.replace(configRule.o, configRule.n);
      });
      text.replace(textBlock, { html: true });
    }
  }
  return new ElementHandler();
}

/**
 * Returns a HTMLRewriter ElementHandler class for schema injection.
 * @param {array} urlConfig - The array of configuration rules.
 * @return {ElementHandler} - The ElementHandler class.
 */
function getSchemaHandler(urlConfig) {
  class ElementHandler {
    element(element) {
      urlConfig.forEach((configRule) => {
        element.append(
          `<script type="application/ld+json">${configRule.o}</script>`,
          { html: true }
        );
      });
    }
  }
  return new ElementHandler();
}

async function handleRequest(request) {
  // Fetch configuration for the current page from InLinks.
  const urlKey = request.url.replace(/\/|\.|\-|\:|\=|\?/gi, "");
  const urlConfig = await getUrlConfig(urlKey);

  // Pass through the request to the origin web server.
  const originResponse = await fetch(request);

  // If configuration rules exist for this page, apply the modifications.
  if (urlConfig && Array.isArray(urlConfig) && urlConfig.length) {
    // Group configuration rules based on type.
    const contentRules = urlConfig.filter((u) => u.t == "p" || u.t == "li");
    const schemaRules = urlConfig.filter((u) => u.t == "s");

    // Set up handlers to rewrite / inject content.
    const contentHandler = getContentHandler(contentRules);
    const schemaHandler = getSchemaHandler(schemaRules);

    return new HTMLRewriter()
      .on("p, li", contentHandler)
      .on("head", schemaHandler)
      .transform(originResponse);
  } else {
    return originResponse;
  }
}

addEventListener("fetch", (event) => {
  event.passThroughOnException();
  event.respondWith(handleRequest(event.request));
});
