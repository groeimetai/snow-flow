/**
 * Express type extensions for SSO
 */

import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    ssoCustomerId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      session: Session & Partial<SessionData>;
      ssoSession?: any;
      customer?: any;
      ssoUser?: any;
    }
  }
}

export {};
