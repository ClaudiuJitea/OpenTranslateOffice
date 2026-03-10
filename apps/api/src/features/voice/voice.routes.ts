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

router.post("/sync", async (req, res) => {
  const conversationId = String(req.body?.conversationId ?? "").trim();
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }

  try {
    const result = await service.syncConversationData(conversationId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error syncing conversation:", error);
    return res.status(500).json({ error: "Failed to sync conversation data" });
  }
});

router.post("/sync-latest", async (req, res) => {
  try {
    const result = await service.syncNewConversationData();
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error syncing latest conversation:", error);
    return res.status(500).json({ error: "Failed to sync latest conversation" });
  }
});

export default router;
