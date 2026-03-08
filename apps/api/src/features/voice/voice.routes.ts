import { Router } from "express";
import { ElevenLabsService } from "./elevenlabs.service";

const router = Router();
const service = new ElevenLabsService();

router.post("/session", async (req, res) => {
  const intakeSessionId = String(req.body?.intakeSessionId ?? "").trim();
  if (!intakeSessionId) {
    return res.status(400).json({ error: "intakeSessionId is required" });
  }

  const session = await service.createClientSession({ intakeSessionId });
  if (!session.configured) {
    return res.status(503).json({
      error: "Voice provider is not configured",
      details: "Set ElevenLabs settings in Admin > Integration Settings"
    });
  }

  return res.status(201).json(session);
});

router.post("/events", async (req, res) => {
  const signature = String(req.headers["x-elevenlabs-signature"] ?? "");
  await service.handleWebhookEvent(req.body, signature);
  return res.status(204).send();
});

export default router;
