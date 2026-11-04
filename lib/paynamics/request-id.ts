import { randomBytes } from 'crypto';

// FR001 requires request_id to be alphanumeric (no dashes/separators) and
// under 32 chars. This format (base36 timestamp + base36 random) stays under
// 19 chars for decades, is monotonic-ish for easy log sorting, and collisions
// require the same millisecond AND the same 24-bit random value (1-in-16.7M
// per ms).
export function generatePaynamicsRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(3).readUIntBE(0, 3).toString(36).padStart(5, '0');
  return `pymt${timestamp}${random}`;
}
