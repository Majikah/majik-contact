/* -------------------------------
 * Errors
 * ------------------------------- */

export class MajikContactError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MajikContactError";
    this.cause = cause;
  }
}
