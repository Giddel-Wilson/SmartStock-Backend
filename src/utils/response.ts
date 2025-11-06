import { Response } from 'express';

export function successResponse(res: Response, payload: any) {
  // Return clean response without unnecessary nesting
  return res.json(payload);
}

export function errorResponse(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}
