import { buildClientSchema, getIntrospectionQuery, printSchema } from 'graphql';

const r = await fetch(process.argv[2] + '/api/v1/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: getIntrospectionQuery() }),
});
const j = await r.json();
console.log(printSchema(buildClientSchema(j.data)));
