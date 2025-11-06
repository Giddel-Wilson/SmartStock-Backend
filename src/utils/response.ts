import { Response } from 'express';

export function successResponse(res: Response, payload: any) {
  // Top-level and nested compatibility
  return res.json({
    ...payload,
    data: { data: payload }
  });
}

export function errorResponse(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}
