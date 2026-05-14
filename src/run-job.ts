import type { DataMergeClient } from './datamerge-client.js';

export type RunJobKind = 'company_enrich' | 'contact_enrich' | 'contact_search';

export interface ContinuationPayload {
  kind: RunJobKind;
  job_id: string;
  started_at: number;
  attempt: number;
}

const DEFAULT_MAX_WAIT_SECONDS = 25;
const HARD_CAP_MAX_WAIT_SECONDS = 28;
const DEFAULT_POLL_INTERVAL_SECONDS = 3;
const SUGGESTED_MAX_ATTEMPTS = 5;

export function encodeContinuationToken(payload: ContinuationPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeContinuationToken(token: string): ContinuationPayload {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed.kind !== 'string' ||
      typeof parsed.job_id !== 'string' ||
      typeof parsed.started_at !== 'number' ||
      typeof parsed.attempt !== 'number'
    ) {
      throw new Error('Malformed continuation_token payload');
    }
    return parsed as ContinuationPayload;
  } catch (err) {
    throw new Error(
      `Invalid continuation_token: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function clampWaitSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_WAIT_SECONDS;
  }
  return Math.min(value, HARD_CAP_MAX_WAIT_SECONDS);
}

const TOOL_NAME_BY_KIND: Record<RunJobKind, string> = {
  company_enrich: 'run_company_enrichment',
  contact_enrich: 'run_contact_enrich',
  contact_search: 'run_contact_search',
};

function pendingInstructionFor(kind: RunJobKind): string {
  const toolName = TOOL_NAME_BY_KIND[kind];
  return (
    `Job is not finished yet. Immediately call ${toolName} again with the returned continuation_token ` +
    `as the only argument. Do not ask the user. Do not call any other tool first. ` +
    `Each call waits up to ~${DEFAULT_MAX_WAIT_SECONDS}s server-side; keep resuming until status is ` +
    `"completed" or "failed" (typically <= ${SUGGESTED_MAX_ATTEMPTS} attempts).`
  );
}

export interface RunJobIterationArgs {
  client: DataMergeClient;
  kind: RunJobKind;
  /** When undefined, a new job will be started using startArgs. */
  continuation?: ContinuationPayload | undefined;
  /** Required when continuation is undefined. */
  startArgs?: Record<string, unknown> | undefined;
  maxWaitSeconds?: number | undefined;
  pollIntervalSeconds?: number | undefined;
}

export interface RunJobResult {
  /** JSON-stringified payload to return in the text content. */
  text: string;
  isError?: boolean;
}

function isCompletedStatus(
  status: string,
  hasResult: boolean,
  kind: RunJobKind,
): boolean {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'succeeded' || s === 'finished') return true;
  // The `hasResult` fallback is only safe for company_enrich, where the status
  // response inlines `results[]` exactly when the job is actually done. For
  // contact_enrich and contact_search the API pre-populates `record_ids` with
  // pending ContactRecords created *before* FullEnrich is called, so
  // record_ids.length > 0 fires immediately after POST and the agent would
  // get back stale/empty rows. For those kinds, require an explicit
  // "completed" status.
  if (kind !== 'company_enrich') return false;
  return hasResult && s !== 'failed' && s !== 'error' && s !== 'errored' && s !== 'cancelled';
}

function isFailedStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'failed' || s === 'error' || s === 'errored' || s === 'cancelled';
}

async function fetchStatus(
  client: DataMergeClient,
  kind: RunJobKind,
  jobId: string,
): Promise<{ status: string; raw: any; success: boolean; error?: string }> {
  if (kind === 'company_enrich') {
    const r = await client.getCompanyEnrichmentResult(jobId);
    if (!r.success) {
      return { status: '', raw: null, success: false, error: (r as any).error ?? 'Unknown error' };
    }
    return { status: r.job.status ?? '', raw: r.job, success: true };
  }
  if (kind === 'contact_search') {
    const r = await client.getContactSearchStatus(jobId);
    if (!r.success) {
      return { status: '', raw: null, success: false, error: (r as any).error ?? 'Unknown error' };
    }
    return { status: (r as any).status ?? '', raw: r, success: true };
  }
  const r = await client.getContactEnrichStatus(jobId);
  if (!r.success) {
    return { status: '', raw: null, success: false, error: (r as any).error ?? 'Unknown error' };
  }
  return { status: (r as any).status ?? '', raw: r, success: true };
}

function extractCreditsConsumed(raw: any): number | undefined {
  const v = raw?.credits_consumed;
  return typeof v === 'number' ? v : undefined;
}

async function buildCompletedPayload(
  client: DataMergeClient,
  kind: RunJobKind,
  jobId: string,
  raw: any,
): Promise<Record<string, unknown>> {
  if (kind === 'company_enrich') {
    const job = raw;
    const recordIds = (job?.record_ids as string[] | undefined) ?? undefined;
    const companies: unknown[] = [];
    if (Array.isArray(job?.results) && job.results.length) {
      companies.push(...job.results);
    }
    if (recordIds?.length && companies.length === 0) {
      for (const recordId of recordIds) {
        const getRes = await client.getCompany({ record_id: recordId });
        if (getRes.success && 'company' in getRes && (getRes as any).company) {
          companies.push((getRes as any).company);
        }
      }
    }
    const credits = extractCreditsConsumed(job);
    return {
      status: 'completed',
      job_id: jobId,
      record_ids: recordIds,
      companies: companies.length ? companies : (job?.results ?? []),
      ...(credits !== undefined ? { credits_consumed_total: credits } : {}),
    };
  }
  // contact_enrich and contact_search both return record_ids of contacts
  const recordIds: string[] | undefined = raw?.record_ids;
  const contacts: unknown[] = [];
  if (recordIds?.length) {
    for (const recordId of recordIds) {
      const getRes = await client.getContact(recordId);
      if (getRes.success) {
        const rec = (getRes as any).record ?? (getRes as any).contact ?? getRes;
        contacts.push(rec);
      }
    }
  }
  const credits = extractCreditsConsumed(raw);
  return {
    status: 'completed',
    job_id: jobId,
    record_ids: recordIds,
    contacts,
    ...(credits !== undefined ? { credits_consumed_total: credits } : {}),
  };
}

async function startJob(
  client: DataMergeClient,
  kind: RunJobKind,
  startArgs: Record<string, unknown>,
): Promise<{ success: boolean; job_id?: string; error?: string }> {
  if (kind === 'company_enrich') {
    const r = await client.startCompanyEnrichment(startArgs as any);
    if (!r.success) {
      return { success: false, error: (r as any).error ?? 'Unknown error' };
    }
    return { success: true, job_id: r.job.id };
  }
  if (kind === 'contact_search') {
    const r = await client.contactSearch(startArgs as any);
    if (!r.success || 'error' in r) {
      return { success: false, error: (r as any).error ?? 'Unknown error' };
    }
    return { success: true, job_id: (r as any).job_id };
  }
  const r = await client.contactEnrich(startArgs as any);
  if (!r.success || 'error' in r) {
    return { success: false, error: (r as any).error ?? 'Unknown error' };
  }
  return { success: true, job_id: (r as any).job_id };
}

export async function runJobIteration(args: RunJobIterationArgs): Promise<RunJobResult> {
  const {
    client,
    kind,
    continuation,
    startArgs,
    maxWaitSeconds,
    pollIntervalSeconds,
  } = args;

  const waitMs = clampWaitSeconds(maxWaitSeconds) * 1000;
  const pollMs =
    typeof pollIntervalSeconds === 'number' && pollIntervalSeconds > 0
      ? pollIntervalSeconds * 1000
      : DEFAULT_POLL_INTERVAL_SECONDS * 1000;

  let jobId: string;
  let startedAt: number;
  let attempt: number;

  if (continuation) {
    if (continuation.kind !== kind) {
      return {
        text: JSON.stringify({
          status: 'error',
          error: `continuation_token is for "${continuation.kind}", cannot be used with this tool ("${kind}").`,
          credits_consumed_total: 0,
        }),
        isError: true,
      };
    }
    jobId = continuation.job_id;
    startedAt = continuation.started_at;
    attempt = continuation.attempt + 1;
  } else {
    if (!startArgs) {
      return {
        text: JSON.stringify({
          status: 'error',
          error: 'Either continuation_token or start parameters must be provided.',
        }),
        isError: true,
      };
    }
    const started = await startJob(client, kind, startArgs);
    if (!started.success || !started.job_id) {
      return {
        text: JSON.stringify({ status: 'error', error: started.error ?? 'Failed to start job' }),
        isError: true,
      };
    }
    jobId = started.job_id;
    startedAt = Date.now();
    attempt = 1;
  }

  const iterationDeadline = Date.now() + waitMs;

  // Always do an immediate first status check before sleeping, so callers
  // with a continuation_token can pick up an already-finished job quickly.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await fetchStatus(client, kind, jobId);
    if (!status.success) {
      return {
        text: JSON.stringify({
          status: 'error',
          job_id: jobId,
          error: status.error ?? 'Failed to fetch job status',
        }),
        isError: true,
      };
    }

    const hasResult =
      kind === 'company_enrich'
        ? Array.isArray(status.raw?.results) && status.raw.results.length > 0
        : Array.isArray(status.raw?.record_ids) && status.raw.record_ids.length > 0;
    // For contact_search, "completed" status from the API is authoritative; record_ids
    // may legitimately be empty (no contacts found for any domain) and the status check
    // already handles that via isCompletedStatus.

    if (isCompletedStatus(status.status, hasResult, kind)) {
      const payload = await buildCompletedPayload(client, kind, jobId, status.raw);
      return { text: JSON.stringify(payload, null, 2) };
    }

    if (isFailedStatus(status.status)) {
      return {
        text: JSON.stringify({
          status: 'failed',
          job_id: jobId,
          job_status: status.status,
        }),
        isError: true,
      };
    }

    if (Date.now() + pollMs >= iterationDeadline) {
      break;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  const nextToken = encodeContinuationToken({
    kind,
    job_id: jobId,
    started_at: startedAt,
    attempt,
  });

  return {
    text: JSON.stringify(
      {
        status: 'pending',
        job_id: jobId,
        continuation_token: nextToken,
        attempt,
        elapsed_seconds: elapsedSeconds,
        suggested_max_attempts: SUGGESTED_MAX_ATTEMPTS,
        next_action: pendingInstructionFor(kind),
      },
      null,
      2,
    ),
  };
}

export const RUN_JOB_DEFAULT_MAX_WAIT_SECONDS = DEFAULT_MAX_WAIT_SECONDS;
export const RUN_JOB_SUGGESTED_MAX_ATTEMPTS = SUGGESTED_MAX_ATTEMPTS;

/**
 * Pre-flight check for run_contact_enrich. Two valid call shapes:
 *
 *   1. Caller provides `domain` for every contact. DataMerge passes the
 *      domain hint to FullEnrich, which heavily improves email accuracy.
 *
 *   2. Caller sets `return_any_domain: true` and accepts that FullEnrich
 *      will pick whichever "current employer" it considers most probable
 *      (which may not match the caller's expectation for people with
 *      multiple plausible affiliations).
 *
 * Any other shape (no domain AND no `return_any_domain: true`) gets a
 * structured `domain_required` response that explains the choice — no
 * job is started.
 *
 * Returns null when the call should proceed (continuation_token, all
 * domains present, or `return_any_domain: true`).
 */
export function checkContactEnrichDomains(args: any): RunJobResult | null {
  if (typeof args?.continuation_token === 'string' && args.continuation_token.length > 0) {
    return null;
  }
  if (args?.return_any_domain === true) return null;

  const contacts = Array.isArray(args?.contacts) ? args.contacts : [];
  if (contacts.length === 0) return null;

  const missing: number[] = [];
  contacts.forEach((c: any, i: number) => {
    if (!c || typeof c !== 'object') return;
    const d = c.domain;
    if (typeof d !== 'string' || d.trim().length === 0) missing.push(i);
  });

  if (missing.length === 0) return null;

  return {
    text: JSON.stringify(
      {
        status: 'domain_required',
        message:
          `${missing.length} contact(s) (index ${missing.join(', ')}) have no \`domain\`. Choose one:` +
          `\n  (a) Add the company \`domain\` to each affected contact and retry — best results.` +
          `\n  (b) Set \`return_any_domain: true\` and retry — DataMerge will run the enrichment ` +
          `without a domain hint, and FullEnrich will pick whichever current employer it considers ` +
          `most probable. This may not match what you expect for people with multiple plausible ` +
          `affiliations (a CEO who also sits on another board, a co-founder of two companies, etc.).`,
        contacts_missing_domain: missing,
        // No enrichment ran; surface a 0-charge so billing layers always
        // have a deterministic field to read.
        credits_consumed_total: 0,
      },
      null,
      2,
    ),
  };
}
