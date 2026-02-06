import { readFile } from 'fs/promises';
import os from 'os';

/**
 * Get the CFS-imposed limit (if any) for the "number of cores" that the process
 * is allowed to use. This may not be a whole number.
 *
 * "Number of cores" is in quotes because this is actually a measure of the
 * total amount of time that the process is able to use in a CFS period. The
 * work is not actually constrained to certain physical cores in the machine (by
 * default), which explains why this value can be fractional.
 *
 * For context on CFS, including why CFS without core pinning can be problematic,
 * see {@link https://danluu.com/cgroup-throttling/}
 * and {@link https://www.uber.com/en-UY/blog/avoiding-cpu-throttling-in-a-containerized-environment/}
 */
async function getCFSLimit() {
  try {
    const [quota, period] = await Promise.all([
      readFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', { encoding: 'utf-8' }),
      readFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us', { encoding: 'utf-8' }),
    ]);

    const cores = Number(quota) / Number(period);
    return Number.isNaN(cores) ? undefined : cores;
  } catch (err) {
    return undefined;
  }
}

// getCFSLimit is super slow and the result is unlikely to change,
// so we don't wanna call it every time someone looks up the available core count.
const cfsLimitAtStartup = await getCFSLimit();

/**
 * @returns {number} The number of cores available to the process, which will
 * either be the number of cores on the machine (or virtual machine, or
 * container, depending on where we're running and how it's configured) or, if a
 * CFS limit is set, the number of "cores" that the Node process is allowed to
 * use, which could be fractional. See {@link getCFSLimit}
 */
export function getUsableCoreCount() {
  return cfsLimitAtStartup ?? os.cpus().length;
}
