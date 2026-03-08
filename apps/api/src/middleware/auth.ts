import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser, UserRole } from "../types/auth";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function getAuthUserFromRequest(req: Request): AuthUser | null {
  const token = req.cookies?.accessToken as string | undefined;
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.authUser = authUser;
  return next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}
