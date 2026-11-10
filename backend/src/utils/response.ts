import { Response } from 'express';
import { ApiResponse } from '../types/common.types';

export { ApiResponse };

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  } as ApiResponse<T>);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400
): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message },
  } as ApiResponse);
}

