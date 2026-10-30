export interface ApiResponse<T = unknown> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown[];
}

export class ClientApiError extends Error {
  statusCode: number;
  errors: unknown[];

  constructor(message: string, statusCode = 500, errors: unknown[] = []) {
    super(message);
    this.name = "ClientApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
