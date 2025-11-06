import { Request, Response } from 'express';
import InventoryLog from '../models/InventoryLog';
import Product from '../models/Product';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/response';

export const getInventoryLogs = async (req: Request, res: Response) => {
  try {
    const { product_id, user_id, change_type, start_date, end_date, limit = 100, offset = 0 } = req.query;
    
    const filters: any = {};
    
    if (product_id) filters.productId = product_id;
    if (user_id) filters.userId = user_id;
    if (change_type) filters.changeType = change_type;
    
    if (start_date || end_date) {
      filters.transactionDate = {};
      if (start_date) filters.transactionDate.$gte = new Date(start_date as string);
      if (end_date) filters.transactionDate.$lte = new Date(end_date as string);
    }
    
    const logs = await InventoryLog.find(filters)
      .populate('productId', 'name sku')
      .populate('userId', 'name email')
      .sort({ transactionDate: -1 })
      .limit(Number(limit))
      .skip(Number(offset));
    
    return successResponse(res, {
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    return errorResponse(res, 'Server error while retrieving inventory logs', 500);
  }
};

export const getInventoryLogsByProduct = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await InventoryLog.find({ productId })
      .populate('productId', 'name sku')
      .populate('userId', 'name email')
      .sort({ transactionDate: -1 })
      .limit(Number(limit));
    
    return successResponse(res, {
      status: 'success',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    return errorResponse(res, 'Server error while retrieving inventory logs', 500);
  }
};

export const getInventoryStats = async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter: any = {};
    if (start_date || end_date) {
      dateFilter.transactionDate = {};
      if (start_date) dateFilter.transactionDate.$gte = new Date(start_date as string);
      if (end_date) dateFilter.transactionDate.$lte = new Date(end_date as string);
    }
    
    const stats = await InventoryLog.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$changeType',
          total: { $sum: '$quantityChanged' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    return successResponse(res, {
      status: 'success',
      stats
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    return errorResponse(res, 'Server error while retrieving inventory stats', 500);
  }
};
