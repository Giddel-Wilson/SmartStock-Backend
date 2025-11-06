import { Request, Response } from 'express';
import Product from '../models/Product';
import InventoryLog from '../models/InventoryLog';
import StockAlert from '../models/StockAlert';
import User from '../models/User';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getInventorySummary = async (req: AuthRequest, res: Response) => {
  try {
    // Get total products count
    const totalProducts = await Product.countDocuments();
    
    // Get total quantity across all products
    const totalQuantityResult = await Product.aggregate([
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    const totalQuantity = totalQuantityResult[0]?.total || 0;
    
    // Get low stock products count
    const lowStockProducts = await Product.countDocuments({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    });
    
    // Get total value of inventory
    const totalValueResult = await Product.aggregate([
      { 
        $group: { 
          _id: null, 
          totalValue: { 
            $sum: { $multiply: ['$quantity', '$unitPrice'] } 
          } 
        } 
      }
    ]);
    const totalValue = totalValueResult[0]?.totalValue || 0;
    
    // Get recent activities (last 10)
    const recentActivities = await InventoryLog.find()
      .populate('userId', 'name')
      .populate('productId', 'name sku')
      .sort({ transactionDate: -1 })
      .limit(10);
    
    // Get pending alerts
    const pendingAlerts = await StockAlert.countDocuments({ alertSent: false });
    
    return successResponse(res, {
      status: 'success',
      summary: {
        totalProducts,
        totalQuantity,
        lowStockProducts,
        totalValue: parseFloat(totalValue.toFixed(2)),
        pendingAlerts,
        recentActivities
      }
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    return errorResponse(res, 'Failed to fetch inventory summary', 500);
  }
};
