export type FetchHTTP = (request: {
  url: string;
  method: 'get' | 'post';
  body?: string;
  headers?: Record<string, string>;
  handleResponseBody: 'discard' | 'as-json';
}) => Promise<{ body: { nextUrl: string } }>;
