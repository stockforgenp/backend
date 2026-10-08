import { Response } from "express";

export interface ApiResponsePayload<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, any>;
}

export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
  meta?: Record<string, any>,
): Response {
  const payload: ApiResponsePayload<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(
  res: Response,
  message: string,
  data?: T,
  meta?: Record<string, any>,
): Response {
  return sendSuccess(res, message, data, 201, meta);
}
