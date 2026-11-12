export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware from the verified JWT subject. */
      user?: { id: string };
    }
  }
}
