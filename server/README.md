# API Server

## Available Scripts

- `npm start` will start the server locally in watch mode. Just make sure that Redis and Postgres are running locally, and your `.env` file has the relevant connection settings to reach them.
- `npm run runWorkerOrJob [workerName] | [jobName]` will run a specific worker or job, which aren't run at all when using `npm run start`. The current set of workers and jobs, and therefore legal arguments for this script, are in the `workers_jobs` directory, besides `index.ts` and `dbTypes.ts`.

 ## Tracing/Logging

Coop uses distributed tracing (OpenTelemetry) for observability. Direct logging via `console.*` is disabled by lint rules. Instead, attach log messages to spans for better correlation and debugging.

### Inject Tracer

This is the canonical way we are obtaining a tracer object. This class comes with custom convenience methods. Implementation can be found [here](./utils/SafeTracer.ts).

```js
class ActionAPI extends DataSource {
  constructor(
    private readonly tracer: Dependencies['Tracer'],
  ){}
}
...
export default inject(
  [
    'Tracer',
  ],
  ActionAPI,
);
```

### Add Active Span

Sometimes you may want to capture a unit of work in its own span in which case you can use `addActiveSpan`.

```js
  return tracer.addActiveSpan(
    { resource: 'snowflake.client', operation: 'snowflake.query' },
    (span) => {
      // do work
    }
  );
```

### Record Exception

This will add the exception as an event to the given span without marking the span as failed. This can be useful when an exception does not necessarily entail the entire operation has failed, e.g. when one iteration of a loop fails but you want to continue processing the remaining elements.

```js
  catch (exception) {
    span.recordException(exception as Exception);
  }
```

### [Legacy] Mark Active Span as Failed

This will record an exception by adding it as an attribute to the active span as well as mark that span as FAILED.

This is considered legacy because a piece of code generally shouldn't be setting the status of a span that it didn't create, which is what's happening when the code reaches for the active span in this way.

```js
catch (e: unknown) {
  Tracer.logActiveSpanFailedIfAny(e);
}
```

