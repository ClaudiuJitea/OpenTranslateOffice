import { promisify } from "node:util";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import type { intakeDocuments } from "@oto/db";
import { env } from "../../config/env";

const execFileAsync = promisify(execFile);

type IntakeDocumentRow = typeof intakeDocuments.$inferSelect;

const WORD_EXTENSIONS = new Set([".doc", ".docx", ".odt", ".rtf"]);
const PREVIEWABLE_INLINE_MIME_PREFIXES = ["image/"];
const PREVIEWABLE_INLINE_MIME_EXACT = new Set(["application/pdf", "text/plain"]);

const conversionLocks = new Map<string, Promise<string>>();

export interface SourcePreviewResolution {
  filePath: string;
  mimeType: string;
  fileName: string;
  wasConverted: boolean;
}

export async function resolveSourcePreview(doc: IntakeDocumentRow): Promise<SourcePreviewResolution> {
  const sourcePath = path.resolve(env.LOCAL_STORAGE_PATH, "intake-uploads", doc.storageKey);
  const extension = (doc.extension || path.extname(doc.originalName) || "").toLowerCase();
  const mimeType = doc.mimeType || "application/octet-stream";

  if (canRenderInline(mimeType, extension)) {
    return {
      filePath: sourcePath,
      mimeType,
      fileName: doc.originalName,
      wasConverted: false
    };
  }

  if (env.LIBREOFFICE_PREVIEW_ENABLED && isWordFamily(extension, mimeType)) {
    try {
      const previewPath = await ensurePdfPreview(doc, sourcePath);
      return {
        filePath: previewPath,
        mimeType: "application/pdf",
        fileName: `${stripExtension(doc.originalName)}.pdf`,
        wasConverted: true
      };
    } catch (error) {
      console.warn(
        `[source-preview] LibreOffice conversion failed for doc=${doc.id} storageKey=${doc.storageKey}:`,
        error
      );
      return {
        filePath: sourcePath,
        mimeType,
        fileName: doc.originalName,
        wasConverted: false
      };
    }
  }

  return {
    filePath: sourcePath,
    mimeType,
    fileName: doc.originalName,
    wasConverted: false
  };
}

function canRenderInline(mimeType: string, extension: string): boolean {
  if (PREVIEWABLE_INLINE_MIME_EXACT.has(mimeType)) {
    return true;
  }

  if (PREVIEWABLE_INLINE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true;
  }

  return extension === ".pdf";
}

function isWordFamily(extension: string, mimeType: string): boolean {
  if (WORD_EXTENSIONS.has(extension)) {
    return true;
  }

  return (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.oasis.opendocument.text" ||
    mimeType === "application/rtf"
  );
}

async function ensurePdfPreview(doc: IntakeDocumentRow, sourcePath: string): Promise<string> {
  const previewDir = path.resolve(env.LOCAL_STORAGE_PATH, "derived-previews");
  await mkdir(previewDir, { recursive: true });

  const lockKey = doc.id;
  const existingLock = conversionLocks.get(lockKey);
  if (existingLock) {
    return existingLock;
  }

  const task = (async () => {
    const sourceStats = await stat(sourcePath);
    const previewFilePath = path.resolve(previewDir, `${doc.id}.pdf`);

    try {
      const previewStats = await stat(previewFilePath);
      if (previewStats.mtimeMs >= sourceStats.mtimeMs) {
        return previewFilePath;
      }
    } catch {
      // no cached preview yet
    }

    const sourceInsideContainer = path.posix.join(
      env.LIBREOFFICE_CONTAINER_STORAGE_ROOT,
      "intake-uploads",
      doc.storageKey
    );
    const previewOutDirInsideContainer = path.posix.join(
      env.LIBREOFFICE_CONTAINER_STORAGE_ROOT,
      "derived-previews"
    );

    await execFileAsync(
      env.LIBREOFFICE_DOCKER_BIN,
      [
        "exec",
        env.LIBREOFFICE_CONTAINER_NAME,
        "soffice",
        "--headless",
        "--nologo",
        "--nolockcheck",
        "--nodefault",
        "--nofirststartwizard",
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        previewOutDirInsideContainer,
        sourceInsideContainer
      ],
      {
        timeout: env.LIBREOFFICE_CONVERT_TIMEOUT_MS,
        windowsHide: true
      }
    );

    const generatedName = `${path.parse(doc.storageKey).name}.pdf`;
    const generatedPath = path.resolve(previewDir, generatedName);
    await stat(generatedPath);

    if (generatedPath !== previewFilePath) {
      await copyFile(generatedPath, previewFilePath);
    }

    return previewFilePath;
  })();

  conversionLocks.set(lockKey, task);

  try {
    return await task;
  } finally {
    conversionLocks.delete(lockKey);
  }
}

function stripExtension(name: string): string {
  const ext = path.extname(name);
  if (!ext) {
    return name;
  }

  return name.slice(0, -ext.length);
}
