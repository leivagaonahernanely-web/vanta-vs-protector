/**
 * Error HTTP con código de estado. Se lanza desde la autenticación de sesión.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const ForbiddenError = (msg: string) => new HttpError(403, msg);
