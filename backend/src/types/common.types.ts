/**
 * Common types used across the application
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ValidationSchema {
  body?: import('joi').ObjectSchema;
  query?: import('joi').ObjectSchema;
  params?: import('joi').ObjectSchema;
}

