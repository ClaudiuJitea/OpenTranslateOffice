import { users } from "@oto/db";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { getDb } from "../../db/runtime";
import { getAuthUserFromRequest } from "../../middleware/auth";

const router = Router();
const db = getDb();

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const match = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  const user = match[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"] }
  );

  res.cookie("accessToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 15
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  });
});

router.post("/logout", async (_req, res) => {
  res.clearCookie("accessToken");
  return res.status(204).send();
});

router.get("/me", async (req, res) => {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.json({ user: null });
  }

  const userId = authUser.id;
  const match = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  const user = match[0];
  if (!user) {
    return res.json({ user: null });
  }

  return res.json({ user });
});

export default router;
