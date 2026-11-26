import os from 'node:os';

// Visitors first: when the server is busy, background work (photo/details autofill, nearby places, mock-test
// autopilot, exam news) waits for a calmer moment instead of competing with page loads.
// JOB_PAUSE_LOAD = jobs waiting per CPU above which background work pauses (default 1.5 → load 3 on 2 CPUs).

const CPUS = os.cpus().length || 1;
let pausedUntil = 0; let pausedWhy = '';
const skipped = new Map();   // job → count skipped while busy

export const loadNow = () => os.loadavg()[0];
export const loadPerCpu = () => os.loadavg()[0] / CPUS;
export const busyLimit = () => Number(process.env.JOB_PAUSE_LOAD || 1.5);

export function serverBusy() {
  return Date.now() < pausedUntil || loadPerCpu() > busyLimit();
}

// the health monitor / error watcher can pause background work for a while (e.g. database overloaded)
export function pauseJobs(ms, why = '') {
  if (Date.now() + ms > pausedUntil) { pausedUntil = Date.now() + ms; pausedWhy = why; }
}
export const resumeJobs = () => { pausedUntil = 0; pausedWhy = ''; };

// wrap a scheduled job: it is skipped (and simply runs on its next turn) while the server is busy
export function whenIdle(name, fn) {
  return async (...args) => {
    if (serverBusy()) {
      skipped.set(name, (skipped.get(name) || 0) + 1);
      console.log(`[load] ${name} postponed — server busy (load ${loadNow().toFixed(1)} on ${CPUS} CPUs)`);
      return { skipped: 'server busy' };
    }
    return fn(...args);
  };
}

export const loadStatus = () => ({
  cpus: CPUS, load: Number(loadNow().toFixed(2)), per_cpu: Number(loadPerCpu().toFixed(2)), limit: busyLimit(),
  busy: serverBusy(), paused_until: pausedUntil > Date.now() ? new Date(pausedUntil).toISOString() : null, paused_why: pausedWhy || null,
  skipped: Object.fromEntries(skipped),
});
