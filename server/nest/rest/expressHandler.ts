import { type NextFunction, type Request, type Response } from 'express';

/**
 * Runs an Express-style handler inside a Nest route, turning `next(err)` into
 * a thrown error so Nest's exception filter handles it. Used for handlers whose
 * bodies have not been rewritten as Nest services yet.
 */
export async function runExpressHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: Response,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const next = (err?: unknown) => (err ? reject(err) : resolve());
    Promise.resolve(handler(req, res, next)).then(() => resolve(), reject);
  });
}
