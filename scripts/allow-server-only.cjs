// Lets CLI scripts import modules marked `import "server-only"` (that marker
// only matters inside Next.js bundles). Usage: node --require ./scripts/allow-server-only.cjs
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require("path").join(__dirname, "..", "node_modules", "server-only", "empty.js");
  return orig.call(this, request, ...rest);
};

// React.cache() only exists in Next's server build of React; outside it, use identity.
const React = require("react");
if (typeof React.cache !== "function") React.cache = (fn) => fn;
