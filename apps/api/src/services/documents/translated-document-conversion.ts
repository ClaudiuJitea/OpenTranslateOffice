import { execFile } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "../../config/env";

const execFileAsync = promisify(execFile);

const SUPPORTED_TARGET_FORMATS = new Map<
  string,
  { extension: string; mimeType: string; convertTo: string }
>([
  ["pdf", { extension: ".pdf", mimeType: "application/pdf", convertTo: "pdf:writer_pdf_Export" }],
  [
    "docx",
    {
      extension: ".docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      convertTo: "docx"
    }
  ],
  ["odt", { extension: ".odt", mimeType: "application/vnd.oasis.opendocument.text", convertTo: "odt" }],
  ["rtf", { extension: ".rtf", mimeType: "application/rtf", convertTo: "rtf" }],
  ["txt", { extension: ".txt", mimeType: "text/plain", convertTo: "txt:Text" }]
]);

export async function convertTranslatedDocument(input: {
  storageKey: string;
  originalName: string;
  targetFormat: string;
}) {
  const format = SUPPORTED_TARGET_FORMATS.get(input.targetFormat.toLowerCase());
  if (!format) {
    throw new Error("Unsupported target format");
  }

  const sourcePath = path.resolve(env.LOCAL_STORAGE_PATH, "ai-translations", input.storageKey);
  const sourceExtension = path.extname(input.storageKey).toLowerCase();
  if (sourceExtension === format.extension) {
    return {
      filePath: sourcePath,
      fileName: input.originalName,
      mimeType: format.mimeType
    };
  }

  const outputDir = path.resolve(env.LOCAL_STORAGE_PATH, "ai-translations-converted");
  await mkdir(outputDir, { recursive: true });

  const cacheBase = `${path.parse(input.storageKey).name}-${input.targetFormat.toLowerCase()}`;
  const finalPath = path.resolve(outputDir, `${cacheBase}${format.extension}`);
  const sourceStats = await stat(sourcePath);

  try {
    const convertedStats = await stat(finalPath);
    if (convertedStats.mtimeMs >= sourceStats.mtimeMs) {
      return {
        filePath: finalPath,
        fileName: replaceExtension(input.originalName, format.extension),
        mimeType: format.mimeType
      };
    }
  } catch {
    // cache miss
  }

  const workDir = path.resolve(outputDir, cacheBase);
  await mkdir(workDir, { recursive: true });
  const workingSourcePath = path.resolve(workDir, `source${sourceExtension}`);
  await copyFile(sourcePath, workingSourcePath);

  const sourceInContainer = containerStoragePathForHostPath(workingSourcePath);
  const outDirInContainer = containerStoragePathForHostPath(workDir);

  await runSoffice([
    "--convert-to",
    format.convertTo,
    "--outdir",
    outDirInContainer,
    sourceInContainer
  ]);

  const generatedPath = path.resolve(workDir, `source${format.extension}`);
  await stat(generatedPath);
  await copyFile(generatedPath, finalPath);

  return {
    filePath: finalPath,
    fileName: replaceExtension(input.originalName, format.extension),
    mimeType: format.mimeType
  };
}

export function listSupportedConvertedFormats(storageKey: string) {
  const sourceExtension = path.extname(storageKey).toLowerCase();
  return Array.from(SUPPORTED_TARGET_FORMATS.entries())
    .filter(([, value]) => value.extension !== sourceExtension)
    .map(([key]) => key);
}

function runSoffice(extraArgs: string[]) {
  return execFileAsync(
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
      ...extraArgs
    ],
    {
      timeout: env.LIBREOFFICE_CONVERT_TIMEOUT_MS,
      windowsHide: true
    }
  );
}

function containerStoragePathForHostPath(hostPath: string) {
  const relative = path.relative(path.resolve(env.LOCAL_STORAGE_PATH), hostPath);
  return path.posix.join(env.LIBREOFFICE_CONTAINER_STORAGE_ROOT, ...relative.split(path.sep));
}

function replaceExtension(fileName: string, nextExtension: string) {
  const currentExtension = path.extname(fileName);
  return currentExtension
    ? `${fileName.slice(0, -currentExtension.length)}${nextExtension}`
    : `${fileName}${nextExtension}`;
}
