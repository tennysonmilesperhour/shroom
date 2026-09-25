import "server-only";
import { createSign } from "node:crypto";
import type { Grid, CellWrite } from "./plan";
import { colLetter } from "./plan";

// Minimal Google Sheets client for the write-back: a service-account token
// (JWT bearer grant, no SDK) plus the three values endpoints we need.
//
// Configuration (Vercel project env, server-only):
//   GOOGLE_SERVICE_ACCOUNT_JSON  the key JSON of a service account; share the
//                                Master Cultivation Reference with its email
//                                as an Editor.
//   MASTER_SHEET_GOOGLE_ID       the spreadsheet id (a native Google Sheet;
//                                an uploaded .xlsx can't be edited per cell).

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
// Overridable only so the local UI-check harness can point at a mock.
const API = process.env.SHROOM_SHEETS_API_BASE || "https://sheets.googleapis.com/v4/spreadsheets";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export function sheetWritebackConfig(): { id: string; account: ServiceAccount } | null {
  const id = process.env.MASTER_SHEET_GOOGLE_ID?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!id || !raw) return null;
  try {
    const account = JSON.parse(raw) as ServiceAccount;
    if (!account.client_email || !account.private_key) return null;
    return { id, account };
  } catch {
    return null;
  }
}

let cachedToken: { value: string; expires: number } | null = null;

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: account.client_email,
    scope: SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key.replace(/\\n/g, "\n"), "base64url");
  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!resp.ok) throw new Error(`Google sign-in failed (${resp.status}). Check GOOGLE_SERVICE_ACCOUNT_JSON.`);
  const body = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

export class SheetClient {
  private titles: string[] | null = null;
  private grids = new Map<string, Grid>();

  constructor(
    private readonly id: string,
    private readonly account: ServiceAccount,
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await accessToken(this.account);
    const resp = await fetch(`${API}/${this.id}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 200);
      if (resp.status === 403) throw new Error("The service account can’t edit the sheet. Share it with the service account email as an Editor.");
      if (resp.status === 404) throw new Error("Sheet not found. Check MASTER_SHEET_GOOGLE_ID.");
      throw new Error(`Google Sheets ${resp.status}: ${detail}`);
    }
    return resp.json();
  }

  async tabTitles(): Promise<string[]> {
    if (!this.titles) {
      const body = (await this.call("?fields=sheets.properties.title")) as { sheets?: { properties: { title: string } }[] };
      this.titles = (body.sheets ?? []).map((s) => s.properties.title);
    }
    return this.titles;
  }

  /** Unformatted values (dates as serial numbers), cached per client. */
  async grid(tab: string): Promise<Grid> {
    const hit = this.grids.get(tab);
    if (hit) return hit;
    const range = encodeURIComponent(quoteTab(tab));
    const body = (await this.call(
      `/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`,
    )) as { values?: Grid };
    const grid = body.values ?? [];
    this.grids.set(tab, grid);
    return grid;
  }

  async write(tab: string, writes: CellWrite[], append: (string | number)[][]): Promise<void> {
    if (writes.length > 0) {
      await this.call("/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: writes.map((w) => ({
            range: `${quoteTab(tab)}!${colLetter(w.col)}${w.row + 1}`,
            values: [[w.value]],
          })),
        }),
      });
    }
    if (append.length > 0) {
      const range = encodeURIComponent(`${quoteTab(tab)}!A1`);
      await this.call(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
        method: "POST",
        body: JSON.stringify({ values: append }),
      });
    }
    // Keep the cached grid honest for any later record in the same run.
    const grid = this.grids.get(tab);
    if (grid) {
      for (const w of writes) {
        grid[w.row] = grid[w.row] ?? [];
        grid[w.row][w.col] = w.value;
      }
      grid.push(...append);
    }
  }
}
