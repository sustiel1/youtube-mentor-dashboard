import { isBase44Enabled } from '@/config/base44Flags';

const REPAIR_TIMEOUT_MS = 180_000;

function toRepairError(data, status = null) {
  const error = new Error(data?.message || 'GEMS JSON repair failed.');
  error.code = data?.error || 'GEMINI_REPAIR_ERROR';
  error.status = status;
  return error;
}

export async function requestGemsJsonRepair({ rawJson, signal } = {}) {
  const payload = { rawJson: String(rawJson || '') };
  if (isBase44Enabled()) {
    const { base44 } = await import('@/api/base44Client');
    if (!base44) throw toRepairError({ error: 'BASE44_UNAVAILABLE', message: 'Base44 client is unavailable.' });
    try {
      return await base44.functions.RepairGemsJson(payload);
    } catch (error) {
      throw toRepairError({
        error: error?.code || 'BASE44_REPAIR_FAILED',
        message: error?.message || 'Base44 RepairGemsJson failed.',
      }, error?.status ?? null);
    }
  }

  const controller = new AbortController();
  const abortExternal = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', abortExternal, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), REPAIR_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('/api/gemini-repair-json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw toRepairError({ error: 'GEMS_REPAIR_TIMEOUT', message: 'GEMS JSON repair request timed out.' });
    }
    throw toRepairError({ error: 'GEMS_REPAIR_NETWORK_ERROR', message: error?.message || 'GEMS JSON repair request failed.' });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', abortExternal);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw toRepairError(data, response.status);
  return data;
}
