import { Response } from 'express';

export function successResponse(res: Response, payload: any) {
  // Frontend expects response.data.data to contain the payload
  // Axios receives the response, so response.data will be what we send
  // We need to send: { data: { data: payload } }
  return res.json({
    data: {
      data: payload
    }
  });
}

export function errorResponse(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}
