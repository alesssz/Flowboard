// Body of every API error response, whatever the status.

export interface ApiError {
  /** The status's reason phrase, e.g. 'Not Found'. */
  error: string;
  /** What went wrong, in one sentence. */
  message: string;
}
