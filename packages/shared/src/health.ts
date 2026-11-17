// Body of GET /api/health.

export interface HealthResponse {
  status: 'ok';
  /** When the response was produced, ISO 8601. */
  timestamp: string;
  /** Seconds since the API process started. */
  uptimeSeconds: number;
}
