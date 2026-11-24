interface SagePostingEvent {
  status: string;
  error_details?: { postingOutcomeUnknown?: boolean | string } | null;
}

interface SageIssueResponse {
  materialIssue?: { reference?: string } | null;
  inventoryReference?: string;
  processReference?: string;
}

export function requiresSageReconciliation(event?: SagePostingEvent | null): boolean {
  const outcome = event?.error_details?.postingOutcomeUnknown;
  return event?.status === 'failed' && (outcome === true || outcome === 'true');
}

export function sageIssueReference(response?: SageIssueResponse | null): string | undefined {
  return response?.materialIssue?.reference || response?.inventoryReference || response?.processReference;
}
