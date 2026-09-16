import { JwtPayload } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        isActive: boolean;
      } & Partial<JwtPayload>;

      userId?: string;
    }
  }
}

export {};