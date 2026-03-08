import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getIntegrationSettings } from "../settings/integration-settings";
import { env } from "../../config/env";

const execFileAsync = promisify(execFile);

const SUPPORTED_INPUT_EXTENSIONS = new Set([".txt", ".doc", ".docx", ".odt", ".rtf", ".pdf"]);

export interface DocumentTranslationInput {
  sourcePath: string;
  sourceFileName: string;
  sourceExtension: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface DocumentTranslationResult {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sourceFamily: "pdf" | "doc" | "docx" | "odt" | "rtf" | "txt";
}

export async function translateDocumentWithAi(
  input: DocumentTranslationInput
): Promise<DocumentTranslationResult> {
  const extension = input.sourceExtension.toLowerCase();
  if (!SUPPORTED_INPUT_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported source document type for AI translation");
  }

  const runId = randomUUID();
  const baseStorageDir = path.resolve(env.LOCAL_STORAGE_PATH);
  const workDir = path.resolve(baseStorageDir, "ai-work", runId);
  const outputDir = path.resolve(baseStorageDir, "ai-translations");
  await mkdir(workDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const sourceWorkingFile = path.resolve(workDir, `source${extension}`);
  await copyFile(input.sourcePath, sourceWorkingFile);

  const family = toFamily(extension);
  const translatedOutputPath =
    extension === ".docx"
      ? await translateDocxDocument({
          sourceDocxPath: sourceWorkingFile,
          workDir,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage
        })
      : extension === ".pdf"
        ? await translatePdfDocument({
            sourcePdfPath: sourceWorkingFile,
            workDir,
            sourceLanguage: input.sourceLanguage,
            targetLanguage: input.targetLanguage
          })
      : await translateViaPlainTextPipeline({
          sourcePath: sourceWorkingFile,
          sourceExtension: extension,
          sourceLanguage: input.sourceLanguage,
          targetLanguage: input.targetLanguage,
          workDir,
          runId
        });

  const finalStorageKey = `${randomUUID()}${extension}`;
  const finalPath = path.resolve(outputDir, finalStorageKey);
  await rename(translatedOutputPath, finalPath);

  const info = await stat(finalPath);
  return {
    storageKey: finalStorageKey,
    originalName: `${stripExtension(input.sourceFileName)}-${normalizeLang(input.targetLanguage)}${extension}`,
    mimeType: mimeForExtension(extension),
    sizeBytes: info.size,
    sourceFamily: family
  };
}

async function translateViaPlainTextPipeline(input: {
  sourcePath: string;
  sourceExtension: string;
  sourceLanguage: string;
  targetLanguage: string;
  workDir: string;
  runId: string;
}) {
  const extractedText = await extractTextForTranslation(
    input.sourcePath,
    input.sourceExtension,
    input.runId
  );
  if (!extractedText.trim()) {
    throw new Error(
      "No translatable text was extracted from the document. The file may be image-only/scanned or protected."
    );
  }

  const translatedText = await translatePlainTextWithOpenRouter({
    text: extractedText,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage
  });

  const translatedTextPath = path.resolve(input.workDir, "translated.txt");
  await writeFile(translatedTextPath, translatedText, "utf8");

  return rebuildDocumentFamily({
    sourceExtension: input.sourceExtension,
    translatedTextPath,
    workDir: input.workDir,
    runId: input.runId
  });
}

async function extractTextForTranslation(
  sourcePath: string,
  extension: string,
  runId: string
): Promise<string> {
  if (extension === ".txt") {
    return readTextFileSmart(sourcePath);
  }

  const txtPath = path.resolve(path.dirname(sourcePath), "source.txt");
  const sourceInContainer = containerStoragePathForHostPath(sourcePath);
  const outDirInContainer = containerStoragePathForHostPath(path.dirname(sourcePath));

  await runSoffice([
    "--convert-to",
    "txt:Text",
    "--outdir",
    outDirInContainer,
    sourceInContainer
  ]);

  let txtExtracted = "";
  try {
    txtExtracted = await readTextFileSmart(txtPath);
  } catch {
    txtExtracted = "";
  }

  if (normalizeExtractedText(txtExtracted)) {
    return normalizeExtractedText(txtExtracted);
  }

  // Fallback: some office files extract better via HTML conversion.
  const htmlPath = path.resolve(path.dirname(sourcePath), "source.html");
  await runSoffice([
    "--convert-to",
    "html:XHTML Writer File",
    "--outdir",
    outDirInContainer,
    sourceInContainer
  ]);

  try {
    const html = await readTextFileSmart(htmlPath);
    const plain = stripHtmlToText(html);
    if (normalizeExtractedText(plain)) {
      return normalizeExtractedText(plain);
    }
  } catch {
    // handled by final throw below
  }

  if (extension === ".pdf") {
    const ocrText = await extractPdfTextWithOcr(sourcePath);
    const normalizedOcr = normalizeExtractedText(ocrText);
    if (normalizedOcr) {
      return normalizedOcr;
    }

    throw new Error(
      `Text extraction failed for run ${runId}. PDF appears scanned/image-only and OCR did not return usable text.`
    );
  }

  if (isImageLikeOfficeSource(sourcePath)) {
    throw new Error(
      `Text extraction failed for run ${runId}. Document appears image-only and requires OCR.`
    );
  }

  {
    throw new Error(`Text extraction failed for run ${runId}`);
  }
}

async function rebuildDocumentFamily(input: {
  sourceExtension: string;
  translatedTextPath: string;
  workDir: string;
  runId: string;
}): Promise<string> {
  const extension = input.sourceExtension;
  if (extension === ".txt") {
    return input.translatedTextPath;
  }

  const targetExtWithoutDot = extension.slice(1);
  const translatedInContainer = containerStoragePathForHostPath(input.translatedTextPath);
  const outDirInContainer = containerStoragePathForHostPath(input.workDir);

  await runSoffice([
    "--convert-to",
    convertFormatForExtension(extension, targetExtWithoutDot),
    "--outdir",
    outDirInContainer,
    translatedInContainer
  ]);

  const generated = path.resolve(input.workDir, `translated.${targetExtWithoutDot}`);

  try {
    await stat(generated);
    return generated;
  } catch {
    throw new Error(`Document reconstruction failed for run ${input.runId}`);
  }
}

async function translateDocxDocument(input: {
  sourceDocxPath: string;
  workDir: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<string> {
  const unpackDir = path.resolve(input.workDir, "docx-unpacked");
  await mkdir(unpackDir, { recursive: true });

  await execFileAsync("unzip", ["-oq", input.sourceDocxPath, "-d", unpackDir], {
    windowsHide: true
  });

  const documentXmlPath = path.resolve(unpackDir, "word", "document.xml");
  const originalXml = await readFile(documentXmlPath, "utf8");
  const paragraphs = extractDocxParagraphs(originalXml);
  const translatable = paragraphs.filter((item) => item.text.trim().length > 0);

  if (translatable.length === 0) {
    throw new Error("No translatable DOCX text nodes were found in word/document.xml");
  }

  const translatedTexts = await translateStructuredSegments({
    segments: translatable.map((item) => item.text),
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage
  });

  let translatedXml = originalXml;
  for (let index = translatable.length - 1; index >= 0; index -= 1) {
    const item = translatable[index];
    translatedXml =
      translatedXml.slice(0, item.start) +
      replaceParagraphText(item.xml, translatedTexts[index]) +
      translatedXml.slice(item.end);
  }

  await writeFile(documentXmlPath, translatedXml, "utf8");

  const translatedDocxPath = path.resolve(input.workDir, "translated.docx");
  await execFileAsync("zip", ["-qr", translatedDocxPath, "."], {
    cwd: unpackDir,
    windowsHide: true
  });

  return translatedDocxPath;
}

async function translatePdfDocument(input: {
  sourcePdfPath: string;
  workDir: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<string> {
  const pages = await extractPdfPagesWithOcrLayout(input.sourcePdfPath);
  const translatableLines = pages.flatMap((page) => page.blocks.map((block) => block.text));

  if (translatableLines.length === 0) {
    throw new Error("No readable text was detected in the PDF for translation");
  }

  const translatedLines = await translateStructuredSegments({
    segments: translatableLines,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage
  });

  let lineIndex = 0;
  const translatedPages = pages.map((page) => ({
    ...page,
    blocks: page.blocks.map((block) => ({
      ...block,
      translatedText: translatedLines[lineIndex++] ?? block.text
    }))
  }));

  return renderTranslatedPdfWithPython(translatedPages, input.workDir);
}

async function translatePlainTextWithOpenRouter(input: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<string> {
  const settings = await getIntegrationSettings();
  if (!settings.openrouterApiKey || !settings.openrouterModel || !settings.openrouterBaseUrl) {
    throw new Error("OpenRouter settings are incomplete");
  }

  const chunks = splitText(input.text, 3200);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const response = await fetch(`${settings.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openrouterApiKey}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "OpenTranslateOffice"
      },
      body: JSON.stringify({
        model: settings.openrouterModel,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You are a professional legal and business translator.",
              `Translate from ${input.sourceLanguage} to ${input.targetLanguage}.`,
              "Preserve structure, line breaks, lists, numbering, and punctuation.",
              "Return only translated text without commentary."
            ].join(" ")
          },
          {
            role: "user",
            content: chunk
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter translation failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) {
      throw new Error("OpenRouter returned empty translation content");
    }

    translatedChunks.push(translated);
  }

  return translatedChunks.join("\n\n");
}

async function translateStructuredSegments(input: {
  segments: string[];
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<string[]> {
  const settings = await getIntegrationSettings();
  if (!settings.openrouterApiKey || !settings.openrouterModel || !settings.openrouterBaseUrl) {
    throw new Error("OpenRouter settings are incomplete");
  }

  const batches = batchSegments(input.segments, 12, 9000);
  const translated: string[] = [];

  for (const batch of batches) {
    const response = await fetch(`${settings.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openrouterApiKey}`,
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "OpenTranslateOffice"
      },
      body: JSON.stringify({
        model: settings.openrouterModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a professional document translator.",
              `Translate from ${input.sourceLanguage} to ${input.targetLanguage}.`,
              "Return valid JSON only.",
              "Schema: {\"translations\":[\"...\"]}.",
              "Translate each array item in order.",
              "Return the same number of items as input.",
              "Do not omit any item.",
              "Preserve line breaks and punctuation."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({ segments: batch })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter structured translation failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned empty structured translation content");
    }

    let parsed: { translations?: string[] } | null = null;
    try {
      parsed = JSON.parse(content) as { translations?: string[] };
    } catch {
      parsed = null;
    }

    if (!parsed?.translations || parsed.translations.length !== batch.length) {
      throw new Error("OpenRouter returned invalid structured translation payload");
    }

    translated.push(...parsed.translations.map((item) => item.trim()));
  }

  return translated;
}

function splitText(input: string, targetChunkSize: number): string[] {
  const normalized = input.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= targetChunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= targetChunkSize) {
      current = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += targetChunkSize) {
      chunks.push(paragraph.slice(index, index + targetChunkSize));
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [normalized];
}

function batchSegments(segments: string[], maxItems: number, maxChars: number) {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    const segmentChars = segment.length;
    const wouldOverflow =
      current.length >= maxItems || (current.length > 0 && currentChars + segmentChars > maxChars);

    if (wouldOverflow) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(segment);
    currentChars += segmentChars;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

async function readTextFileSmart(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  if (buffer.length === 0) {
    return "";
  }

  const utf8Text = buffer.toString("utf8");
  const nullRatio = utf8Text.length > 0 ? (utf8Text.match(/\u0000/g)?.length ?? 0) / utf8Text.length : 0;
  if (nullRatio > 0.1) {
    return buffer.toString("utf16le").replace(/\u0000/g, "");
  }

  return utf8Text.replace(/\u0000/g, "");
}

function normalizeExtractedText(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function isImageLikeOfficeSource(_sourcePath: string): boolean {
  return false;
}

function extractDocxParagraphs(xml: string) {
  const paragraphs: Array<{ start: number; end: number; xml: string; text: string }> = [];
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;

  for (const match of xml.matchAll(paragraphRegex)) {
    const paragraphXml = match[0];
    const start = match.index ?? 0;
    const end = start + paragraphXml.length;
    const text = collectParagraphText(paragraphXml);
    paragraphs.push({ start, end, xml: paragraphXml, text });
  }

  return paragraphs;
}

function collectParagraphText(paragraphXml: string) {
  const textRegex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
  const fragments: string[] = [];

  for (const match of paragraphXml.matchAll(textRegex)) {
    fragments.push(decodeXml(match[2]));
  }

  return fragments.join("");
}

function replaceParagraphText(paragraphXml: string, translatedText: string) {
  const textRegex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
  let seenFirst = false;

  return paragraphXml.replace(textRegex, (_full, attrs: string) => {
    if (!seenFirst) {
      seenFirst = true;
      const needsPreserve =
        translatedText.startsWith(" ") || translatedText.endsWith(" ") || translatedText.includes("\n");
      const nextAttrs =
        needsPreserve && !attrs.includes("xml:space=")
          ? `${attrs} xml:space="preserve"`
          : attrs;
      const xmlText = escapeXml(translatedText).replace(/\n/g, "&#10;");
      return `<w:t${nextAttrs}>${xmlText}</w:t>`;
    }

    return `<w:t${attrs}></w:t>`;
  });
}

function decodeXml(value: string) {
  return value
    .replace(/&#10;/g, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function runSoffice(extraArgs: string[]) {
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
      ...extraArgs
    ],
    {
      timeout: env.LIBREOFFICE_CONVERT_TIMEOUT_MS,
      windowsHide: true
    }
  );
}

async function extractPdfTextWithOcr(sourcePath: string): Promise<string> {
  const workDir = path.dirname(sourcePath);
  const sourceInContainer = containerStoragePathForHostPath(sourcePath);
  const pagesDirInContainer = path.posix.join(
    env.LIBREOFFICE_CONTAINER_STORAGE_ROOT,
    ...path.relative(path.resolve(env.LOCAL_STORAGE_PATH), workDir).split(path.sep)
  );
  const pagesPrefixInContainer = path.posix.join(pagesDirInContainer, "ocr-page");
  const tesseractLang = mapTesseractLanguageFromPath(sourcePath);

  const command = [
    `rm -f ${shellQuote(pagesDirInContainer)}/ocr-page-*.png`,
    `pdftoppm -png -r 200 ${shellQuote(sourceInContainer)} ${shellQuote(pagesPrefixInContainer)}`,
    `for img in ${shellQuote(pagesDirInContainer)}/ocr-page-*.png; do`,
    `  if [ -f "$img" ]; then`,
    `    tesseract "$img" stdout -l ${shellQuote(tesseractLang)} 2>/dev/null || true`,
    `    printf '\\n\\n'`,
    `  fi`,
    `done`
  ].join("\n");

  const { stdout } = await execFileAsync(
    env.LIBREOFFICE_DOCKER_BIN,
    ["exec", env.LIBREOFFICE_CONTAINER_NAME, "sh", "-lc", command],
    {
      timeout: Math.max(env.LIBREOFFICE_CONVERT_TIMEOUT_MS, 240000),
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  return stdout;
}

async function extractPdfPagesWithOcrLayout(sourcePath: string) {
  const workDir = path.dirname(sourcePath);
  const sourceInContainer = containerStoragePathForHostPath(sourcePath);
  const pagesDirInContainer = path.posix.join(
    env.LIBREOFFICE_CONTAINER_STORAGE_ROOT,
    ...path.relative(path.resolve(env.LOCAL_STORAGE_PATH), workDir).split(path.sep)
  );
  const pagesPrefixInContainer = path.posix.join(pagesDirInContainer, "ocr-page");
  const tesseractLang = mapTesseractLanguageFromPath(sourcePath);

  const command = [
    `rm -f ${shellQuote(pagesDirInContainer)}/ocr-page-*.png`,
    `rm -f ${shellQuote(pagesDirInContainer)}/ocr-page-*.hocr`,
    `pdftoppm -png -r 150 ${shellQuote(sourceInContainer)} ${shellQuote(pagesPrefixInContainer)}`,
    `for img in ${shellQuote(pagesDirInContainer)}/ocr-page-*.png; do`,
    `  if [ -f "$img" ]; then`,
    `    base="\${img%.png}"`,
    `    tesseract "$img" "$base" -l ${shellQuote(tesseractLang)} hocr 2>/dev/null || true`,
    `  fi`,
    `done`
  ].join("\n");

  await execFileAsync(
    env.LIBREOFFICE_DOCKER_BIN,
    ["exec", env.LIBREOFFICE_CONTAINER_NAME, "sh", "-lc", command],
    {
      timeout: Math.max(env.LIBREOFFICE_CONVERT_TIMEOUT_MS, 240000),
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  const hostFiles = await import("node:fs/promises").then((fs) => fs.readdir(workDir));
  const imageFiles = hostFiles
    .filter((file) => /^ocr-page-\d+\.png$/i.test(file))
    .sort(naturalCompare);

  const pages = [];
  for (const imageFile of imageFiles) {
    const base = imageFile.replace(/\.png$/i, "");
    const hocrPath = path.resolve(workDir, `${base}.hocr`);
    const hocr = await readFile(hocrPath, "utf8").catch(() => "");
    if (!hocr) {
      continue;
    }

    const pageBox = extractPageBox(hocr);
    const blocks = extractHocrBlocks(hocr);
    pages.push({
      imageFileName: imageFile,
      width: pageBox.width,
      height: pageBox.height,
      blocks
    });
  }

  return pages;
}

function containerStoragePathForHostPath(hostPath: string): string {
  const relative = path.relative(path.resolve(env.LOCAL_STORAGE_PATH), hostPath);
  return path.posix.join(env.LIBREOFFICE_CONTAINER_STORAGE_ROOT, ...relative.split(path.sep));
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function convertFormatForExtension(extension: string, fallback: string): string {
  if (extension === ".pdf") {
    return "pdf:writer_pdf_Export";
  }

  return fallback;
}

function mimeForExtension(extension: string): string {
  const map: Record<string, string> = {
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".rtf": "application/rtf",
    ".pdf": "application/pdf"
  };

  return map[extension] ?? "application/octet-stream";
}

function stripExtension(fileName: string): string {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

function normalizeLang(language: string): string {
  return language.trim().toLowerCase().replace(/\s+/g, "-") || "translated";
}

function mapTesseractLanguageFromPath(_sourcePath: string) {
  return "eng+pol+deu+fra+spa+ita+por+nld";
}

function extractPageBox(hocr: string) {
  const match = hocr.match(/class=['"]ocr_page['"][^>]*title=['"][^'"]*bbox (\d+) (\d+) (\d+) (\d+)/i);
  if (!match) {
    return { width: 1240, height: 1754 };
  }

  return {
    width: Number(match[3]) - Number(match[1]),
    height: Number(match[4]) - Number(match[2])
  };
}

function extractHocrBlocks(hocr: string) {
  const paragraphBlocks = extractHocrByClass(hocr, "ocr_par");
  if (paragraphBlocks.length > 0) {
    return paragraphBlocks;
  }

  return extractHocrByClass(hocr, "ocr_line");
}

async function renderTranslatedPdfWithPython(
  pages: Array<{
    imageFileName: string;
    width: number;
    height: number;
    blocks: Array<{
      left: number;
      top: number;
      width: number;
      height: number;
      translatedText: string;
    }>;
  }>,
  workDir: string
) {
  const dataPath = path.resolve(workDir, "translated-pdf-layout.json");
  const scriptPath = path.resolve(workDir, "render_pdf_overlay.py");
  const outputPath = path.resolve(workDir, "translated-pdf-layout.pdf");

  const payload = {
    dpi: 150,
    pages: pages.map((page) => ({
      width: page.width,
      height: page.height,
      image_path: containerStoragePathForHostPath(path.resolve(workDir, page.imageFileName)),
      blocks: page.blocks
    }))
  };

  await writeFile(dataPath, JSON.stringify(payload), "utf8");
  await writeFile(scriptPath, buildPdfOverlayRendererScript(), "utf8");

  await execFileAsync(
    env.LIBREOFFICE_DOCKER_BIN,
    [
      "exec",
      env.LIBREOFFICE_CONTAINER_NAME,
      "python3",
      containerStoragePathForHostPath(scriptPath),
      containerStoragePathForHostPath(dataPath),
      containerStoragePathForHostPath(outputPath)
    ],
    {
      timeout: Math.max(env.LIBREOFFICE_CONVERT_TIMEOUT_MS, 240000),
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024
    }
  );

  await stat(outputPath);
  return outputPath;
}

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function extractHocrByClass(hocr: string, className: "ocr_par" | "ocr_line") {
  const results: Array<{ left: number; top: number; width: number; height: number; text: string }> = [];
  const regex = new RegExp(
    `<(?:span|div)[^>]*class=['"][^'"]*${className}[^'"]*['"][^>]*title=['"][^'"]*bbox (\\d+) (\\d+) (\\d+) (\\d+)[^'"]*['"][^>]*>([\\s\\S]*?)<\\/(?:span|div)>`,
    "gi"
  );

  for (const match of hocr.matchAll(regex)) {
    const text = stripHtmlToText(match[5]).replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    const left = Number(match[1]);
    const top = Number(match[2]);
    const right = Number(match[3]);
    const bottom = Number(match[4]);

    results.push({
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      text
    });
  }

  return results;
}

function buildPdfOverlayRendererScript() {
  return [
    "import json",
    "import sys",
    "from reportlab.lib.utils import ImageReader",
    "from reportlab.pdfbase import pdfmetrics",
    "from reportlab.pdfbase.ttfonts import TTFont",
    "from reportlab.pdfgen import canvas",
    "",
    "FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'",
    "FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'",
    "",
    "def px_to_pt(value, dpi):",
    "    return (value * 72.0) / dpi",
    "",
    "def wrap_text(text, font_name, font_size, max_width):",
    "    words = text.split()",
    "    if not words:",
    "        return []",
    "    lines = []",
    "    current = words[0]",
    "    for word in words[1:]:",
    "        candidate = current + ' ' + word",
    "        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:",
    "            current = candidate",
    "        else:",
    "            lines.append(current)",
    "            current = word",
    "    lines.append(current)",
    "    return lines",
    "",
    "def fit_wrapped(text, font_name, max_font_size, min_font_size, max_width, max_height):",
    "    size = max_font_size",
    "    while size >= min_font_size:",
    "        wrapped = wrap_text(text, font_name, size, max_width)",
    "        line_gap = size * 1.18",
    "        if len(wrapped) * line_gap <= max_height:",
    "            return size, wrapped",
    "        size -= 0.5",
    "    return min_font_size, wrap_text(text, font_name, min_font_size, max_width)",
    "",
    "def draw_block(c, block, page_height_px, dpi):",
    "    left = px_to_pt(block['left'], dpi)",
    "    top = px_to_pt(block['top'], dpi)",
    "    width = px_to_pt(block['width'], dpi)",
    "    height = px_to_pt(block['height'], dpi)",
    "    page_height = px_to_pt(page_height_px, dpi)",
    "    y = page_height - top - height",
    "    dark_header = block['top'] < page_height_px * 0.18",
    "    bg = (52/255.0, 67/255.0, 91/255.0) if dark_header else (1, 1, 1)",
    "    fg = (1, 1, 1) if dark_header else (0.07, 0.07, 0.07)",
    "    c.saveState()",
    "    c.setFillColorRGB(*bg)",
    "    c.rect(left, y, width, height, fill=1, stroke=0)",
    "    c.restoreState()",
    "    font_name = 'DejaVuSans-Bold' if dark_header else 'DejaVuSans'",
    "    font_guess = max(7, min(15, px_to_pt(block['height'] * 0.42, dpi)))",
    "    usable_width = max(10, width - 6)",
    "    usable_height = max(8, height - 4)",
    "    font_size, wrapped = fit_wrapped(block.get('translatedText', ''), font_name, font_guess, 7, usable_width, usable_height)",
    "    c.setFillColorRGB(*fg)",
    "    c.setFont(font_name, font_size)",
    "    text_y = y + height - font_size - 2",
    "    line_gap = font_size * 1.15",
    "    for row in wrapped:",
    "        c.drawString(left + 3, text_y, row)",
    "        text_y -= line_gap",
    "        if text_y < y - 2:",
    "            break",
    "",
    "def main():",
    "    with open(sys.argv[1], 'r', encoding='utf-8') as fh:",
    "        payload = json.load(fh)",
    "    pdfmetrics.registerFont(TTFont('DejaVuSans', FONT_REGULAR))",
    "    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', FONT_BOLD))",
    "    dpi = payload.get('dpi', 150)",
    "    pages = payload['pages']",
    "    first = pages[0]",
    "    c = canvas.Canvas(sys.argv[2], pagesize=(px_to_pt(first['width'], dpi), px_to_pt(first['height'], dpi)))",
    "    for index, page in enumerate(pages):",
    "        page_size = (px_to_pt(page['width'], dpi), px_to_pt(page['height'], dpi))",
    "        if index > 0:",
    "            c.setPageSize(page_size)",
    "        c.drawImage(ImageReader(page['image_path']), 0, 0, width=page_size[0], height=page_size[1], preserveAspectRatio=False, mask='auto')",
    "        for block in page['blocks']:",
    "            draw_block(c, block, page['height'], dpi)",
    "        c.showPage()",
    "    c.save()",
    "",
    "if __name__ == '__main__':",
    "    main()",
    ""
  ].join("\n");
}

function toFamily(
  extension: string
): "pdf" | "doc" | "docx" | "odt" | "rtf" | "txt" {
  const key = extension.replace(/^\./, "") as "pdf" | "doc" | "docx" | "odt" | "rtf" | "txt";
  if (["pdf", "doc", "docx", "odt", "rtf", "txt"].includes(key)) {
    return key;
  }

  return "txt";
}
