import type { intakeDocuments } from "@oto/db";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "../../config/env";
import { resolveSourcePreview } from "./source-preview";

const execFileAsync = promisify(execFile);

type IntakeDocumentRow = typeof intakeDocuments.$inferSelect;

export async function countDocumentPages(doc: IntakeDocumentRow): Promise<number> {
  const extension = (doc.extension || path.extname(doc.originalName) || "").toLowerCase();

  if (extension === ".pdf") {
    return countPdfPages(
      path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey)
    );
  }

  if (extension === ".docx") {
    const fromMetadata = await countDocxPagesFromMetadata(doc).catch(() => null);
    if (fromMetadata && fromMetadata > 0) {
      return fromMetadata;
    }
  }

  const preview = await resolveSourcePreview(doc);
  if (preview.mimeType === "application/pdf") {
    const counted = await countPdfPages(preview.filePath).catch(() => null);
    if (counted && counted > 0) {
      return counted;
    }
  }

  if (extension === ".txt") {
    const textPath = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey);
    const text = await readFile(textPath, "utf8").catch(() => "");
    return estimateTextPages(text);
  }

  return 1;
}

export async function countRequestPages(docs: IntakeDocumentRow[]) {
  let total = 0;

  for (const doc of docs) {
    total += Math.max(1, await countDocumentPages(doc).catch(() => 1));
  }

  return Math.max(1, total);
}

async function countPdfPages(filePath: string) {
  const buffer = await readFile(filePath);
  const content = buffer.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page\b/g);
  if (matches && matches.length > 0) {
    return matches.length;
  }

  const countMatches = Array.from(content.matchAll(/\/Count\s+(\d+)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (countMatches.length > 0) {
    return Math.max(...countMatches);
  }

  return 1;
}

async function countDocxPagesFromMetadata(doc: IntakeDocumentRow) {
  const sourcePath = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey);
  const { stdout } = await execFileAsync("unzip", ["-p", sourcePath, "docProps/app.xml"], {
    windowsHide: true
  });
  const match = stdout.match(/<Pages>(\d+)<\/Pages>/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function estimateTextPages(text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return 1;
  }

  const words = normalized.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 500));
}
