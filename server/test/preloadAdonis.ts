// Import the AdonisJS app modules before any test runs. The first import
// through Vite takes over a second, which would otherwise count against the
// first test in a file that boots a server (5s timeout).
await import('../server.js');
