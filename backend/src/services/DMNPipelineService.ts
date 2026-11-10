/**
 * DMN Pipeline Service
 *
 * HTTP client for the DMN Agent Pipeline AI service. Used to run document-to-DMN
 * pipelines (summarize, decision tables, full DMN code) and poll job status/result.
 */

import { logger } from '../utils/logger';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
// Full pipeline (upload + AI stages) can take 2–5+ min; make configurable
const DEFAULT_PIPELINE_RUN_TIMEOUT_MS = 300_000; // 5 min
const PIPELINE_RUN_TIMEOUT_MS =
  parseInt(process.env.DMN_PIPELINE_RUN_TIMEOUT_MS || String(DEFAULT_PIPELINE_RUN_TIMEOUT_MS), 10) ||
  DEFAULT_PIPELINE_RUN_TIMEOUT_MS;

export type DmnIntent = 'summarize' | 'dmn_tables' | 'dmn_code';

/**
 * Maps app intent to AI pipeline stop_at (dmn_agent_pipeline PipelineStage).
 * Valid stop_at: rules | aggregation | assembly | dmndi | refinement
 */
export const INTENT_TO_STOP_AT: Record<DmnIntent, string> = {
  summarize: 'rules',
  dmn_tables: 'aggregation',
  dmn_code: 'refinement',
};

export interface RunPipelineOptions {
  dmnName?: string;
  stopAt: string; // e.g. 'rules' | 'aggregation' | 'assembly' | 'refinement'
}

export interface RunPipelineResponse {
  job_id: string;
  document_id: string;
  dmn_name: string;
  stop_at: string;
  status: string;
  message: string;
}

export interface JobProgressResponse {
  job_id: string;
  status: string;
  progress: number;
  current_stage: string | null;
  completed_stages: string[];
  remaining_stages: string[];
  message: string | null;
  api_usage?: Record<string, unknown>;
  elapsed_seconds?: number;
}

/**
 * AI service pipeline result shape (aligned with dmn_agent_pipeline api/models/pipeline_models and routes/pipeline _prepare_result_data).
 */
export interface JobResultResponse {
  job_id: string;
  document_id: string;
  dmn_name: string;
  stopped_at: string;
  result: {
    extract_rules?: {
      rules: unknown[];
      entities: unknown[];
      relationships?: unknown[];
      rule_count: number;
      entity_count: number;
    };
    build_tables?: {
      glossary: Record<string, unknown>;
      drg_nodes?: unknown[];
      drg_edges?: unknown[];
      bkms?: unknown[];
      item_definitions?: unknown[];
      input_data?: unknown[];
      decisions: unknown[];
      decision_count: number;
    };
    generate_dmn?: { dmn_xml: string; validation_report?: unknown };
    dmn_xml?: string;
    validate_dmn?: {
      is_valid: boolean;
      technical_validation?: unknown;
      execution_test?: unknown;
      refinement_count?: number;
    };
    errors?: string[];
  };
  api_usage?: Record<string, unknown>;
}

/**
 * Pipeline stages from AI service (GET /pipeline/stages).
 * Stage names: document, rules, glossary, drg, bkm, schema, tables, aggregation,
 * sanitization, validation, assembly, dmndi, tech_validation, exec_test, refinement.
 */
export interface StagesResponse {
  stages: { name: string; order: number; progress_percent: number; description: string }[];
  recommended_stop_points: Record<string, string>;
}

/** Single job in list (AI service GET /jobs). */
export interface JobListResponse {
  job_id: string;
  document_id?: string;
  status: string;
  progress: number;
  current_stage?: string | null;
  message?: string | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** AI service POST /pipeline/resume/{job_id} response (202). */
export interface ResumePipelineResponse {
  job_id: string;
  previous_job_id: string;
  document_id: string;
  resume_from: string;
  stop_at: string;
  status: string;
  message: string;
}

export class DMNPipelineService {
  private baseUrl: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.DMN_PIPELINE_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = parseInt(process.env.DMN_PIPELINE_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10) || DEFAULT_TIMEOUT_MS;
  }

  /**
   * Run the DMN pipeline on a document (file buffer + filename).
   * Returns job_id for polling progress and result.
   */
  async runPipeline(
    fileBuffer: Buffer,
    filename: string,
    options: RunPipelineOptions
  ): Promise<RunPipelineResponse> {
    const url = `${this.baseUrl}/pipeline/run`;
    logger.info('[DMN] service runPipeline start', {
      url,
      filename,
      bufferBytes: fileBuffer.length,
      stopAt: options.stopAt,
      dmnName: options.dmnName,
    });

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
    if (options.dmnName) form.append('dmn_name', options.dmnName);
    form.append('stop_at', options.stopAt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PIPELINE_RUN_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // AI service returns 202 Accepted (async); pipeline runs in background
      if (res.status !== 200 && res.status !== 202) {
        const text = await res.text();
        logger.error('[DMN] service runPipeline AI response not ok', {
          status: res.status,
          statusText: res.statusText,
          bodyPreview: text.slice(0, 500),
        });
        throw new Error(`DMN pipeline run failed: ${res.status} ${res.statusText}. ${text}`);
      }

      const data = (await res.json()) as RunPipelineResponse;
      logger.info('[DMN] service runPipeline success', {
        jobId: data.job_id,
        documentId: data.document_id,
        stopAt: data.stop_at,
        status: data.status,
      });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger.error('[DMN] service runPipeline timeout', {
            url,
            timeoutMs: PIPELINE_RUN_TIMEOUT_MS,
            hint: 'Increase DMN_PIPELINE_RUN_TIMEOUT_MS if the AI pipeline needs more time.',
          });
          throw new Error(`DMN pipeline run timed out (${PIPELINE_RUN_TIMEOUT_MS / 1000}s)`);
        }
        const cause = (e as { cause?: { code?: string; errno?: number } }).cause;
        logger.error('[DMN] service runPipeline error', {
          url,
          error: e.message,
          causeCode: cause?.code,
          hint: cause?.code === 'ECONNREFUSED'
            ? 'DMN pipeline not reachable. Is it running on the host? Use host.docker.internal and ensure backend has extra_hosts (Linux).'
            : cause?.code === 'ENOTFOUND'
              ? 'DMN pipeline host not found. On Linux Docker, add extra_hosts: host.docker.internal:host-gateway to backend.'
              : undefined,
        });
        throw e;
      }
      throw new Error('DMN pipeline run failed');
    }
  }

  /** Get job progress. */
  async getJobProgress(jobId: string): Promise<JobProgressResponse> {
    const url = `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/progress`;
    logger.debug('[DMN] service getJobProgress', { jobId, url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        logger.warn('[DMN] service getJobProgress not ok', { jobId, status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN job progress failed: ${res.status}. ${text}`);
      }

      const data = (await res.json()) as JobProgressResponse;
      logger.debug('[DMN] service getJobProgress result', {
        jobId,
        status: data.status,
        progress: data.progress,
        current_stage: data.current_stage,
      });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger.error('[DMN] service getJobProgress timeout', { jobId, url });
          throw new Error('DMN job progress timed out');
        }
        throw e;
      }
      throw new Error('DMN job progress failed');
    }
  }

  /** Get job result (only valid when status is completed). */
  async getJobResult(jobId: string): Promise<JobResultResponse> {
    const url = `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}/result`;
    logger.info('[DMN] service getJobResult', { jobId, url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        logger.warn('[DMN] service getJobResult not ok', { jobId, status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN job result failed: ${res.status}. ${text}`);
      }

      const data = (await res.json()) as JobResultResponse;
      logger.info('[DMN] service getJobResult success', {
        jobId,
        stopped_at: data.stopped_at,
        hasDmnXml: Boolean(data.result?.dmn_xml),
        hasExtractRules: Boolean(data.result?.extract_rules),
        hasBuildTables: Boolean(data.result?.build_tables),
      });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger.error('[DMN] service getJobResult timeout', { jobId, url });
          throw new Error('DMN job result timed out');
        }
        throw e;
      }
      throw new Error('DMN job result failed');
    }
  }

  /** Get job status (lightweight). */
  async getJobStatus(jobId: string): Promise<{ job_id: string; status: string; progress: number; message?: string }> {
    const url = `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`;
    logger.debug('[DMN] service getJobStatus', { jobId, url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        logger.warn('[DMN] service getJobStatus not ok', { jobId, status: res.status });
        throw new Error(`DMN job status failed: ${res.status}. ${text}`);
      }

      const data = (await res.json()) as { job_id: string; status: string; progress: number; message?: string };
      logger.debug('[DMN] service getJobStatus result', { jobId, status: data.status, progress: data.progress });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger.error('[DMN] service getJobStatus timeout', { jobId, url });
          throw new Error('DMN job status timed out');
        }
        throw e;
      }
      throw new Error('DMN job status failed');
    }
  }

  /** List pipeline stages (for UI). */
  async getStages(): Promise<StagesResponse> {
    const url = `${this.baseUrl}/pipeline/stages`;
    logger.debug('[DMN] service getStages', { url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        logger.warn('[DMN] service getStages not ok', { status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN stages failed: ${res.status}. ${text}`);
      }

      const data = (await res.json()) as StagesResponse;
      logger.info('[DMN] service getStages success', { stageCount: data.stages?.length ?? 0 });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger.error('[DMN] service getStages timeout', { url });
          throw new Error('DMN stages timed out');
        }
        throw e;
      }
      throw new Error('DMN stages failed');
    }
  }

  /** List jobs from the AI service (all jobs; caller must filter by tenant). */
  async listJobs(limit: number = 50): Promise<JobListResponse[]> {
    const url = `${this.baseUrl}/jobs?limit=${Math.min(limit, 100)}`;
    logger.debug('[DMN] service listJobs', { url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const text = await res.text();
        logger.warn('[DMN] service listJobs not ok', { status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN list jobs failed: ${res.status}. ${text}`);
      }
      const data = (await res.json()) as JobListResponse[];
      logger.debug('[DMN] service listJobs result', { count: data?.length ?? 0 });
      return Array.isArray(data) ? data : [];
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') throw new Error('DMN list jobs timed out');
        throw e;
      }
      throw new Error('DMN list jobs failed');
    }
  }

  /** Delete a job on the AI service. */
  async deleteJob(jobId: string): Promise<void> {
    const url = `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`;
    logger.info('[DMN] service deleteJob', { jobId, url });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, { method: 'DELETE', signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status !== 200 && res.status !== 204) {
        const text = await res.text();
        if (res.status === 404) throw new Error('Job not found');
        logger.warn('[DMN] service deleteJob not ok', { jobId, status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN delete job failed: ${res.status}. ${text}`);
      }
      logger.info('[DMN] service deleteJob success', { jobId });
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') throw new Error('DMN delete job timed out');
        throw e;
      }
      throw new Error('DMN delete job failed');
    }
  }

  /** Resume a completed job (returns new job_id). */
  async resumeJob(jobId: string, stopAt?: string): Promise<ResumePipelineResponse> {
    const url = `${this.baseUrl}/pipeline/resume/${encodeURIComponent(jobId)}`;
    logger.info('[DMN] service resumeJob', { jobId, url, stopAt });

    const form = new FormData();
    if (stopAt) form.append('stop_at', stopAt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.status !== 200 && res.status !== 202) {
        const text = await res.text();
        logger.warn('[DMN] service resumeJob not ok', { jobId, status: res.status, body: text.slice(0, 200) });
        throw new Error(`DMN resume job failed: ${res.status}. ${text}`);
      }
      const data = (await res.json()) as ResumePipelineResponse;
      logger.info('[DMN] service resumeJob success', { previousJobId: jobId, newJobId: data.job_id });
      return data;
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        if (e.name === 'AbortError') throw new Error('DMN resume job timed out');
        throw e;
      }
      throw new Error('DMN resume job failed');
    }
  }

  /** Check if the DMN pipeline service is reachable. */
  async isAvailable(): Promise<boolean> {
    const url = `${this.baseUrl}/health`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const ok = res.ok;
      logger.debug('[DMN] service isAvailable', { url, ok, status: res.status });
      return ok;
    } catch (e) {
      logger.warn('[DMN] service isAvailable failed', { url, error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  }
}

export const dmnPipelineService = new DMNPipelineService();
