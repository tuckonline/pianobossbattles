/** Bound outage traffic without delaying successful live presentation. */
export class RequestBackoff {
  private failures = 0;
  private retryAt = 0;
  remaining() { return Math.max(0, this.retryAt - Date.now()); }
  failed() {
    this.failures = Math.min(this.failures + 1, 6);
    this.retryAt = Date.now() + Math.min(60_000, 3_000 * 2 ** (this.failures - 1));
  }
  succeeded() { this.failures = 0; this.retryAt = 0; }
}
