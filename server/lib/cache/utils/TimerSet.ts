import { delay } from "./utils.js";

/**
 * Stores/runs a set of timers and can alert callers when all timers
 * have finished, and that can be closed by callers.
 */
export default class TimerSet {
  // We have to actually store the timers (eek),
  // not just a count, to support close functionality.
  private readonly timers: Set<any> = new Set();
  private closed = false;

  public setTimeout(
    cb: (...args: any[]) => void,
    ms: number,
    ...args: any[]
  ): NodeJS.Timeout {
    if (this.closed) {
      throw new Error("TimerSet is closed. New timers cannot be added.");
    }

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      cb(...args);
    }, ms);

    this.timers.add(timer);
    return timer;
  }

  public clearTimeout(timeout: NodeJS.Timeout) {
    this.timers.delete(timeout);
    clearTimeout(timeout);
  }

  /**
   * Stops the set from accepting more timers and returns a promise that
   * resolves when all known timers are done. If `timeout` ms elapse before
   * the timers finish, it `unref`s them so they don't block the node process
   * from closing, and then its returned promise resolves.
   */
  public async close(timeout?: number) {
    this.closed = true;

    // Ironic to use a timer to poll a count of timers, but hey.
    const timersDone = async (): Promise<void> =>
      this.timers.size === 0 ? undefined : delay(20).then(timersDone);

    if (timeout === undefined) {
      return timersDone();
    }

    const unrefAllAfterTimeout = delay(timeout).then(() => {
      this.timers.forEach((it) => {
        it.unref();
      });
    });

    await Promise.race([unrefAllAfterTimeout, timersDone()]);
  }
}
