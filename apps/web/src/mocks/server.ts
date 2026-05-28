// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Server-side MSW for use in Vitest / Node.js environments.
// Usage in tests:
//
//   import { server } from '@/mocks/server'
//
//   beforeAll(() => server.listen())
//   afterEach(() => server.resetHandlers())
//   afterAll(() => server.close())
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const server = setupServer(...(handlers as any[]));