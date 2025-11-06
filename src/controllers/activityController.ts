import { Request, Response } from 'express';
import ActivityLog from '../models/ActivityLog';
import { successResponse, errorResponse } from '../utils/response';

export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { user_id, action, start_date, end_date, limit = 100, offset = 0 } = req.query;
    
    const filters: any = {};
    
    if (user_id) filters.userId = user_id;
    if (action) filters.action = action;
    
    if (start_date || end_date) {
      filters.createdAt = {};
      if (start_date) filters.createdAt.$gte = new Date(start_date as string);
      if (end_date) filters.createdAt.$lte = new Date(end_date as string);
    }
    
    const logs = await ActivityLog.find(filters)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));
    
    return successResponse(res, {
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return errorResponse(res, 'Server error while retrieving activity logs', 500);
  }
};

export const getActivityLogsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await ActivityLog.find({ userId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    
    return successResponse(res, {
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return errorResponse(res, 'Server error while retrieving activity logs', 500);
  }
};

export const logActivity = async (userId: string, action: string, details?: string, req?: Request) => {
  try {
    const activityLog = new ActivityLog({
      userId,
      action,
      details,
      ipAddress: req?.ip || req?.headers['x-forwarded-for'] || null,
      userAgent: req?.headers['user-agent'] || null
    });
    
    await activityLog.save();
    return activityLog;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};
