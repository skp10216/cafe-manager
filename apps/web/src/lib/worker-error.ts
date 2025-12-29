'use client';

import {
  mapWorkerErrorToGuide,
  type WorkerErrorGuide,
} from '@cafe-manager/core';

type WorkerErrorContext = 'INIT_SESSION' | 'VERIFY_SESSION' | 'CREATE_POST' | 'JOB';

export function toWorkerErrorGuide(
  errorMessage?: string | null,
  errorCode?: string | null,
  context: WorkerErrorContext = 'JOB'
): WorkerErrorGuide | null {
  return mapWorkerErrorToGuide({
    errorMessage: errorMessage || undefined,
    errorCode: errorCode || undefined,
    context,
  });
}

export function getWorkerErrorHeadline(
  errorMessage?: string | null,
  errorCode?: string | null,
  context: WorkerErrorContext = 'JOB'
): string | null {
  const guide = toWorkerErrorGuide(errorMessage, errorCode, context);
  return guide?.headline || guide?.description || null;
}

