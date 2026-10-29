// Minimal worker_threads pool for the build: the per-city panchang months (331 × ~61 engine.panchang calls, ~13 ms each)
// are CPU-bound and independent, so they run on min(4, cores - 1) workers; everything else stays on the main thread.
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

export function poolSize() {
  const env = Number(process.env.WEB_BUILD_WORKERS);
  if (Number.isFinite(env) && env >= 1) return Math.floor(env);
  return Math.max(1, Math.min(4, availableParallelism() - 1));
}

/**
 * Runs `jobs` through `workers` instances of `workerFile` (each receives `workerData`, answers each posted job with
 * {id, result} or {id, error}). Resolves with the results in job order.
 */
export function runPool(workerFile, workerData, jobs, workers = poolSize()) {
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0;
    let done = 0;
    let failed = false;
    const pool = [];
    const finish = () => {
      for (const w of pool) w.terminate();
    };
    const feed = (w) => {
      if (next >= jobs.length) return;
      const id = next++;
      w.postMessage({ id, job: jobs[id] });
    };
    for (let i = 0; i < Math.min(workers, Math.max(1, jobs.length)); i++) {
      const w = new Worker(workerFile, { workerData });
      pool.push(w);
      w.on('message', (msg) => {
        if (failed) return;
        if (msg.error) {
          failed = true;
          finish();
          reject(new Error(msg.error));
          return;
        }
        results[msg.id] = msg.result;
        done += 1;
        if (done === jobs.length) {
          finish();
          resolve(results);
        } else feed(w);
      });
      w.on('error', (e) => {
        if (failed) return;
        failed = true;
        finish();
        reject(e);
      });
      feed(w);
    }
    if (jobs.length === 0) {
      finish();
      resolve(results);
    }
  });
}
