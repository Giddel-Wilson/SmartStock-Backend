import { Response } from 'express';

export function successResponse(res: Response, payload: any) {
  // Return response with nested data structure for frontend compatibility
  // Frontend expects response.data.data to contain the actual payload
  return res.json({
    success: true,
    data: {
      data: payload
    }
  });
}

export function errorResponse(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}
