import { Request, Response } from 'express';
import { successResponse } from '../utils/response';

export const healthCheck = (req: Request, res: Response) => {
  return successResponse(res, {
    status: 'ok',
    message: 'SmartStock API (Express) - health check',
    timestamp: new Date().toISOString()
  });
};
