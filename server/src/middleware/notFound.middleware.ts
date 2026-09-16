import { Request, Response, NextFunction } from "express";

/**
 * Unknown API route.
 *
 * The path used to be echoed back into the body. It is JSON, so that was not
 * directly exploitable, but reflecting attacker-controlled text into a
 * response is a habit worth not having: it hands a prober a confirmation
 * oracle and it is one Content-Type mistake away from being an XSS sink.
 * The method and path are in the request log, which is where they belong.
 */
export const notFoundMiddleware = (
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  res.status(404).json({
    success: false,
    message: "That endpoint does not exist.",
    errors: null,
  });
};
