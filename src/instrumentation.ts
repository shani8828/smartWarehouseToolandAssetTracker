// Runs once when the Next.js server starts. The Node-only scheduler lives in
// its own module so it is never bundled for the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
