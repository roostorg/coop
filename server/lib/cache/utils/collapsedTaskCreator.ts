import { type Logger } from "../types/index.js";
import { defaultLoggersByComponent } from "../utils/utils.js";

/**
 * Imagine you have an function that, when called, kicks off a task, and
 * returns a promise representing the result of the task. Now, suppose the task
 * is expensive, but not effectful, like fetching from a REST API. If your code
 * attempts to run this task many times in quick succession, or many times in
 * parallel, this can be wasteful (if the result will always or likely be the
 * same) and/or overload whatever's doing work as part of the task (eg the API).
 *
 * There are a large number of npm packages that make it easy to better schedule
 * this work (e.g., queueing some parallel runs of the task behind others, if
 * the number of tasks already running exceeds some concurrency limit) or to
 * reuse the results of some runs of the task for others (by debouncing or
 * throttling calls to the function that starts the task). However, none of them
 * have quite the -- admittedly a bit quirky -- semantics that we want, and that
 * we implement here.
 *
 * Specifically, this function accepts a function for starting/creating tasks,
 * along with some options, and returns a new function that behaves like the
 * original except that the promise resulting from a call is reused on
 * subsequent calls if and only if: 1) the subsequent calls have the same
 * arguments [a la memoize]; 2) less than a certain number of milliseconds have
 * passed [a la throttle]; and 3) the original task is still running [unique].
 * In other words, it memoizes the original task-starting function, but then
 * reverts to calling through to the original function after a certain number
 * of milliseconds or after the last-started task finishes, whichever is first.
 * So it's sort of a combination of memoize, throttle, and promise chaining.
 *
 * @param taskCreator The task creation function
 * @param collapseTasksMs The number of milliseconds up until which, if a caller
 *   tries to start the same task while a previous version of the task is still
 *   running, the promise for the result of the currently-running task will be
 *   returned instead.
 * @param key A function for converting the arguments passed to the task
 *   creation into a cache key, like in your standard memoize implementation.
 */
export default function collapsedTaskCreator<Args extends unknown[], Result>(
  taskCreator: (...args: Args) => Promise<Result>,
  collapseTasksMs: number,
  // TODO: think about how to make this whole key generation process type safe.
  // E.g., how to verify that, if JSON.stringify is used, the value is properly
  // stringifyable? Would it be better to just have no default key option?
  key: (args: Args) => any = JSON.stringify.bind(JSON),
  logger: Logger = defaultLoggersByComponent["collapsed-task-creator"],
) {
  // Tuple of [PromiseForTaskResult, taskStartTimestamp].
  const pendingTasks = new Map<any, [Promise<Result>, number]>();
  const logTrace = logger.bind(null, "collapsed-task-creator", "trace");

  return async (...args: Args) => {
    const taskKey = key(args);
    const res = pendingTasks.get(taskKey);
    const now = Date.now();
    logTrace("requested = new state for taskKey/args", { args, taskKey });

    if (!res || now - res[1] > collapseTasksMs) {
      logTrace(
        res
          ? "started new task; there _was_ an in-progress one, but it's too old"
          : "started new task b/c there was no in-progress task for these args",
        args,
      );

      const taskRes = taskCreator(...args).finally(async () => {
        // Only remove this task from pendingTasks if pendingTasks[taskKey]
        // is still the same task. (It could be a new one if the old one was
        // overwritten for taking longer than collapseTasksMs.)
        const pendingValueNow = pendingTasks.get(taskKey);
        if (pendingValueNow && pendingValueNow[0] === taskRes) {
          logTrace("completed = new state for taskKey/args", { args, taskKey });
          pendingTasks.delete(taskKey);
        }
      });

      // Save the new task as a pending task. This will be _replacing_
      // an existing pending task for this key if the other was too old.
      pendingTasks.set(taskKey, [taskRes, now]);
      logTrace("pending = new state for taskKey/args", { args, taskKey });
      return taskRes;
    }

    logTrace(
      "reusing result from prior, still-in-progress run of task for args/taskKey",
      { args, taskKey },
    );
    return res[0];
  };
}
