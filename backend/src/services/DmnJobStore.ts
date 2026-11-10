/**
 * In-memory store mapping DMN pipeline job_id to clientId for tenant isolation.
 * Only the client that started a job can access its progress and result.
 */

const store = new Map<string, { clientId: string }>();

export function setJobClient(jobId: string, clientId: string): void {
  store.set(jobId, { clientId });
}

export function getJobClient(jobId: string): string | undefined {
  return store.get(jobId)?.clientId;
}

export function belongsToClient(jobId: string, clientId: string): boolean {
  return getJobClient(jobId) === clientId;
}

/** Get all job IDs that belong to a client (for list filtering). */
export function getJobIdsForClient(clientId: string): string[] {
  return [...store.entries()]
    .filter(([, v]) => v.clientId === clientId)
    .map(([k]) => k);
}

/** Remove job from store (e.g. after delete). */
export function removeJobClient(jobId: string): void {
  store.delete(jobId);
}
