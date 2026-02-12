import { ensureAuthenticated } from "../auth/oauth.js";
import type {
  DocumentInfo,
  SheetData,
  SheetInfo,
  SpreadsheetInfo,
} from "../types/index.js";

/**
 * Extract spreadsheet ID from a URL or return the ID if it's already an ID
 */
export function extractSpreadsheetId(idOrUrl: string): string {
  // Check if it's a URL
  if (idOrUrl.includes("docs.google.com/spreadsheets")) {
    const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return match[1];
    }
  }
  // Assume it's already an ID
  return idOrUrl;
}

/**
 * Get spreadsheet metadata including list of sheets
 */
export async function getSpreadsheet(
  spreadsheetId: string
): Promise<SpreadsheetInfo> {
  const oauth = await ensureAuthenticated();
  const sheets = oauth.getSheetsClient();

  const id = extractSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.get({
    spreadsheetId: id,
    fields:
      "spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))",
  });

  const spreadsheet = response.data;

  const sheetsList: SheetInfo[] = (spreadsheet.sheets || []).map((sheet) => ({
    sheetId: sheet.properties?.sheetId || 0,
    title: sheet.properties?.title || "Untitled",
    index: sheet.properties?.index || 0,
    rowCount: sheet.properties?.gridProperties?.rowCount ?? undefined,
    columnCount: sheet.properties?.gridProperties?.columnCount ?? undefined,
  }));

  return {
    id: spreadsheet.spreadsheetId || id,
    name: spreadsheet.properties?.title || "Untitled",
    sheets: sheetsList,
    webViewLink: spreadsheet.spreadsheetUrl || undefined,
  };
}

/**
 * Get data from a specific range in a spreadsheet
 */
export async function getSheetData(
  spreadsheetId: string,
  range: string
): Promise<SheetData> {
  const oauth = await ensureAuthenticated();
  const sheets = oauth.getSheetsClient();

  const id = extractSpreadsheetId(spreadsheetId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });

  return {
    spreadsheetId: id,
    range: response.data.range || range,
    values: (response.data.values || []) as string[][],
  };
}

/**
 * List Google Sheets accessible to the user
 */
export async function listSpreadsheets(
  limit: number = 10,
  query?: string
): Promise<DocumentInfo[]> {
  const oauth = await ensureAuthenticated();
  const drive = oauth.getDriveClient();

  // Build query for Google Sheets
  let q =
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
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
