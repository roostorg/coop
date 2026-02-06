// Everything that Kubernetes might run, excluding our main server.
export type WorkerOrJob = Worker | Job;

export type Worker = { type: 'Worker' } & Runnable;
export type Job = { type: 'Job' } & Runnable;

// TODO: support generic arguments being passed to run()? Right now, the only
// place these args could come from is a k8s config file (where they'd be
// hardcoded), so it's much simpler (and easier for devs to reason about) if we
// just hardcode them in the `run` function directly. Down the line, though,
// argument support might make sense.
type Runnable = {
  /**
   * @param signal A signal that will be aborted by the runner when the
   *  job/worker needs to be shutdown (immediately before `shutdown()` is
   *  called.) The run method can listen to abort events on this signal or
   *  check if this signal is aborted, as an alternate way to do cleanup on
   *  shutdown or avoid scheduling new work. In some cases, this is more
   *  ergonomic than, e.g., the worker having to track a "shutdown called" bit
   *  of state explicitly.
   */
  run(signal?: AbortSignal): Promise<void>;

  /**
   * Logic to run when the task is shutdown, either because it finishes (i.e.,
   * the promise returned by `run()` settles), or because it has to be aborted
   * (e.g., because a new version of the code is being deployed). This function
   * should close any resources so that the task can exit cleanly.
   */
  shutdown(): Promise<void>;
};
