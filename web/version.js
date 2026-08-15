/**
 * The version of OpenTenant you are running.
 *
 * The browser app has no build step, so it cannot read package.json — this file
 * is what the running app shows. `npm run bump` writes both at once so they can
 * never disagree, and `npm run version:check` fails if they ever do.
 */
export const VERSION = "1.1.1";
