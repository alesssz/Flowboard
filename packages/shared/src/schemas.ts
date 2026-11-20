// Runtime entry point, @flowboard/shared/schemas: the Zod schemas of the request bodies, for the API.
// Apart from the main entry point, so the web app, which imports only types and limits, never bundles Zod.
export { createCardRequestSchema, updateCardRequestSchema } from './card-requests.ts';
