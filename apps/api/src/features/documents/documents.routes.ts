import { Router } from "express";

const router = Router();

router.post("/", async (_req, res) => {
  // TODO: validate metadata and persist document reference.
  res.status(201).json({ documentId: "doc_xxx" });
});

router.get("/:id/download", async (_req, res) => {
  // TODO: resolve storage key and stream file bytes.
  res.status(501).json({ error: "Not implemented" });
});

export default router;
