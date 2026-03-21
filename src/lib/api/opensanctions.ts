import { HTTPClient } from "./http-client";

const BASE_URL = "https://api.opensanctions.org";

// --- Response types ---

export interface OSEntity {
  id: string;
  caption: string;
  schema: string;
  properties: Record<string, (string | OSEntity)[]>;
  datasets: string[];
  referents: string[];
  target: boolean;
  first_seen: string;
  last_seen: string;
  last_change: string;
}

export interface OSScoredEntity extends OSEntity {
  score: number;
  match: boolean;
}

export interface OSMatchResponse {
  responses: Record<
    string,
    {
      query: Record<string, unknown>;
      results: OSScoredEntity[];
      total: { value: number; relation: string };
    }
  >;
}

export interface OSSearchResponse {
  results: OSEntity[];
  total: { value: number; relation: string };
  facets: Record<string, { values: { name: string; count: number }[] }>;
}

// --- Client ---

export class OpenSanctionsClient {
  private http: HTTPClient;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("API key required");

    this.http = new HTTPClient({
      baseUrl: BASE_URL,
      headers: { Authorization: `ApiKey ${apiKey}` },
      timeout: 30_000,
      retries: 2,
      rateLimitMs: 200,
      sourceName: "OpenSanctions",
    });
  }

  async match(
    name: string,
    options?: {
      birthDate?: string;
      dataset?: string;
      threshold?: number;
      limit?: number;
    }
  ): Promise<OSScoredEntity[]> {
    const dataset = options?.dataset ?? "peps";
    const body = {
      queries: {
        q: {
          schema: "Person",
          properties: {
            name: [name],
            ...(options?.birthDate ? { birthDate: [options.birthDate] } : {}),
          },
        },
      },
      threshold: options?.threshold ?? 0.7,
      limit: options?.limit ?? 5,
    };

    const resp = await this.http.post<OSMatchResponse>(`/match/${dataset}`, body);
    return resp.data.responses?.q?.results ?? [];
  }

  async getEntity(entityId: string, nested = true): Promise<OSEntity> {
    const resp = await this.http.get<OSEntity>(`/entities/${entityId}?nested=${nested}`);
    return resp.data;
  }

  async search(
    query: string,
    options?: {
      dataset?: string;
      countries?: string[];
      topics?: string[];
      limit?: number;
    }
  ): Promise<OSSearchResponse> {
    const dataset = options?.dataset ?? "default";
    const params = new URLSearchParams({ q: query });
    if (options?.countries) {
      options.countries.forEach((c) => params.append("countries", c));
    }
    if (options?.topics) {
      options.topics.forEach((t) => params.append("topics", t));
    }
    if (options?.limit) {
      params.set("limit", String(options.limit));
    }

    const resp = await this.http.get<OSSearchResponse>(`/search/${dataset}?${params}`);
    return resp.data;
  }
}

export function createOpenSanctionsClient(): OpenSanctionsClient | null {
  const apiKey = process.env.OPENSANCTIONS_API_KEY;
  if (!apiKey) return null;
  return new OpenSanctionsClient(apiKey);
}
