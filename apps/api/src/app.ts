import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import { initDatabase } from "./db/runtime";
import adminRoutes from "./features/admin/settings.routes";
import authRoutes from "./features/auth/auth.routes";
import documentsRoutes from "./features/documents/documents.routes";
import intakeRoutes from "./features/intake/intake.routes";
import jobsRoutes from "./features/jobs/jobs.routes";
import portalRoutes from "./features/portal/portal.routes";
import voiceRoutes from "./features/voice/voice.routes";
import { requireAuth, requireRole } from "./middleware/auth";

export async function createApp() {
  await initDatabase();
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api" });
  });

  app.use("/api/intake", intakeRoutes);
  app.use("/api/portal", portalRoutes);
  app.use("/api/voice", voiceRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", requireAuth, requireRole(["ADMIN"]), adminRoutes);
  app.use("/api/jobs", requireAuth, requireRole(["EMPLOYEE", "ADMIN"]), jobsRoutes);
  app.use(
    "/api/documents",
    requireAuth,
    requireRole(["EMPLOYEE", "ADMIN", "CUSTOMER"]),
    documentsRoutes
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large. Maximum size is 25MB per file." });
      }
      return res.status(400).json({ error: `Upload error: ${error.code}` });
    }

    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: "Unexpected server error" });
  });

  return app;
}
