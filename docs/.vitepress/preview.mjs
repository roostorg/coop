import { serve } from 'vitepress';

const app = await serve({ root: '.', port: 4173 });
const notFound = app.onNoMatch;

// VitePress's preview fallback omits the HTML content type on 404 responses.
app.onNoMatch = (request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  return notFound(request, response);
};
