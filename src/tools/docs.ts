import type { docs_v1 } from "googleapis";
import { ensureAuthenticated } from "../auth/oauth.js";
import type { DocumentContent, DocumentInfo } from "../types/index.js";

/**
 * Extract document ID from a URL or return the ID if it's already an ID
 */
export function extractDocumentId(idOrUrl: string): string {
  // Check if it's a URL
  if (idOrUrl.includes("docs.google.com")) {
    const match = idOrUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }
  }
  // Assume it's already an ID
  return idOrUrl;
}

/**
 * Convert Google Docs structural elements to plain text
 */
function extractTextFromElements(
  elements: docs_v1.Schema$StructuralElement[] | undefined
): string {
  if (!elements) return "";

  let text = "";

  for (const element of elements) {
    if (element.paragraph) {
      for (const elem of element.paragraph.elements || []) {
        if (elem.textRun?.content) {
          text += elem.textRun.content;
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += extractTextFromElements(cell.content);
          text += "\t";
        }
        text += "\n";
      }
    } else if (element.sectionBreak) {
      text += "\n---\n";
    }
  }

  return text;
}

/**
 * Get the full content of a Google Doc
 */
export async function getDocument(
  documentId: string
): Promise<DocumentContent> {
  const oauth = await ensureAuthenticated();
  const docs = oauth.getDocsClient();

  const id = extractDocumentId(documentId);

  const response = await docs.documents.get({
    documentId: id,
  });

  const doc = response.data;
  const body = extractTextFromElements(doc.body?.content);

  return {
    id: doc.documentId || id,
    title: doc.title || "Untitled",
    body: body.trim(),
  };
}

/**
 * List Google Docs accessible to the user
 */
export async function listDocuments(
  limit: number = 10,
  query?: string
): Promise<DocumentInfo[]> {
  const oauth = await ensureAuthenticated();
  const drive = oauth.getDriveClient();

  // Build query for Google Docs
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (query) {
    q += ` and fullText contains '${query.replace(/'/g, "\\'")}'`;
  }

  const response = await drive.files.list({
    q,
    pageSize: limit,
    fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
    orderBy: "modifiedTime desc",
  });

  const files = response.data.files || [];

  return files.map((file) => ({
    id: file.id || "",
    name: file.name || "Untitled",
    mimeType: file.mimeType || "",
    modifiedTime: file.modifiedTime || undefined,
    webViewLink: file.webViewLink || undefined,
  }));
}

/**
 * Search documents by content
 */
export async function searchDocuments(
  query: string,
  limit: number = 10
): Promise<DocumentInfo[]> {
  return listDocuments(limit, query);
}
