// Re-export everything from the mocks sub-modules.
// Note: handlers.ts is excluded from browser entry — browser.ts uses inline handlers
// to avoid a TypeScript AnyHandler cross-module type incompatibility in msw v2.
export { server } from "./server";
export { initMsw } from "./browser";

/**
 * Feature flag — controls whether MSW intercepts fetch calls.
 * Gate: NEXT_PUBLIC_MSW=true
 *
 * Call this in browser code to check whether the mock layer is active.
 * The actual MSW worker is only initialised via `initMsw()` in app/layout.tsx.
 */
export function isMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MSW === "true";
}