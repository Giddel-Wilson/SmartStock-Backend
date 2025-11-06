import { Request, Response } from 'express';
import StockAlert from '../models/StockAlert';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

export const getStockAlerts = async (req: Request, res: Response) => {
  try {
    const { alert_sent, limit = 100, offset = 0 } = req.query;
    
    const filters: any = {};
    if (alert_sent !== undefined) {
      filters.alertSent = alert_sent === 'true';
    }
    
    const alerts = await StockAlert.find(filters)
      .populate('productId', 'name sku quantity lowStockThreshold')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));
    
    return successResponse(res, {
      status: 'success',
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    return errorResponse(res, 'Server error while retrieving stock alerts', 500);
  }
};

export const getUnsentAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = await StockAlert.find({ alertSent: false })
      .populate('productId', 'name sku quantity lowStockThreshold')
      .sort({ createdAt: 1 });
    
    return successResponse(res, {
      status: 'success',
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching unsent alerts:', error);
    return errorResponse(res, 'Server error while retrieving unsent alerts', 500);
  }
};

export const markAlertAsSent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const alert = await StockAlert.findByIdAndUpdate(
      id,
      { alertSent: true, sentAt: new Date() },
      { new: true }
    ).populate('productId', 'name sku quantity lowStockThreshold');
    
    if (!alert) {
      return errorResponse(res, 'Stock alert not found', 404);
    }
    
    return successResponse(res, {
      status: 'success',
      message: 'Alert marked as sent',
      alert
    });
  } catch (error) {
    console.error('Error marking alert as sent:', error);
    return errorResponse(res, 'Server error while updating alert', 500);
  }
};

export const deleteAlert = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const alert = await StockAlert.findByIdAndDelete(id);
    
    if (!alert) {
      return errorResponse(res, 'Stock alert not found', 404);
    }
    
    return successResponse(res, {
      status: 'success',
      message: 'Stock alert deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return errorResponse(res, 'Server error while deleting alert', 500);
  }
};
