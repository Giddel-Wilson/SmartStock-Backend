import { Response } from 'express';

export function successResponse(res: Response, payload: any) {
  // Frontend expects: response.data.data.user, response.data.data.accessToken, etc.
  // Axios puts HTTP response body in response.data
  // So we send: { data: payload }
  // Result: response.data = { data: payload }
  // Frontend gets: response.data.data = payload (which has user, accessToken, etc.)
  return res.json({
    data: payload
  });
}

export function errorResponse(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}
