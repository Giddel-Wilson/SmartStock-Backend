import { Request, Response } from 'express';
import Product from '../models/Product';
import InventoryLog from '../models/InventoryLog';
import StockAlert from '../models/StockAlert';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// Helper function to check and create stock alerts
const checkLowStockThreshold = async (productId: string) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return;
    
    if (product.quantity <= product.lowStockThreshold) {
      // Check if alert already exists
      const existingAlert = await StockAlert.findOne({ productId });
      if (!existingAlert) {
        await StockAlert.create({
          productId,
          thresholdReached: true,
          alertSent: false
        });
      }
    } else {
      // Remove alert if stock is back above threshold
      await StockAlert.deleteOne({ productId });
    }
  } catch (error) {
    console.error('Error checking low stock threshold:', error);
  }
};

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { category_id, low_stock, search, sort_by = 'name', sort_direction = 'asc' } = req.query;
    
    const filters: any = {};
    if (category_id) filters.categoryId = category_id;
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    let query = Product.find(filters).populate('categoryId', 'name').populate('createdBy', 'name email');
    
    // Add low stock filter
    if (low_stock === 'true') {
      query = query.where('quantity').lte(10); // Will use $expr for proper comparison
    }
    
    // Add sorting
    const sortOrder = sort_direction === 'desc' ? -1 : 1;
    query = query.sort({ [sort_by as string]: sortOrder });
    
    const products = await query;
    
    return successResponse(res, { 
      status: 'success',
      count: products.length,
      products 
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    return errorResponse(res, 'Failed to fetch products', 500);
  }
};

export const getLowStockProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find()
      .where('quantity')
      .lte(10) // This will be improved with $expr
      .populate('categoryId', 'name')
      .populate('createdBy', 'name email')
      .sort({ quantity: 1 });
    
    return successResponse(res, {
      status: 'success',
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Error fetching low stock products:', err);
    return errorResponse(res, 'Failed to fetch low stock products', 500);
  }
};

export const getProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('categoryId', 'name description')
      .populate('createdBy', 'name email');
    
    if (!product) return errorResponse(res, 'Product not found', 404);
    
    return successResponse(res, { 
      status: 'success',
      product 
    });
  } catch (err) {
    console.error('Error fetching product:', err);
    return errorResponse(res, 'Failed to fetch product', 500);
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, description, quantity, unitPrice, lowStockThreshold, categoryId } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }
    
    const product = await Product.create({ 
      name, 
      sku, 
      description,
      quantity: quantity || 0, 
      unitPrice, 
      lowStockThreshold: lowStockThreshold || 10,
      categoryId,
      createdBy: userId
    });
    
    // Create inventory log for initial stock
    if (quantity && quantity > 0) {
      await InventoryLog.create({
        productId: product._id,
        userId,
        changeType: 'restock',
        quantityChanged: quantity,
        oldQuantity: 0,
        newQuantity: quantity,
        notes: 'Initial stock'
      });
    }
    
    // Check if low stock alert needed
    await checkLowStockThreshold(String(product._id));
    
    return successResponse(res, { 
      status: 'success',
      message: 'Product created successfully',
      product 
    });
  } catch (err: any) {
    console.error('Error creating product:', err);
    if (err.code === 11000) {
      return errorResponse(res, 'Product with this SKU already exists', 400);
    }
    return errorResponse(res, 'Failed to create product', 400);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }
    
    const oldProduct = await Product.findById(id);
    if (!oldProduct) return errorResponse(res, 'Product not found', 404);
    
    const product = await Product.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true })
      .populate('categoryId', 'name')
      .populate('createdBy', 'name email');
    
    // Log inventory change if quantity changed
    if (updates.quantity !== undefined && updates.quantity !== oldProduct.quantity) {
      const changeType = updates.quantity > oldProduct.quantity ? 'restock' : 'sale';
      await InventoryLog.create({
        productId: id,
        userId,
        changeType: 'edit',
        quantityChanged: Math.abs(updates.quantity - oldProduct.quantity),
        oldQuantity: oldProduct.quantity,
        newQuantity: updates.quantity,
        notes: `Product quantity updated from ${oldProduct.quantity} to ${updates.quantity}`
      });
      
      // Check if low stock alert needed
      await checkLowStockThreshold(id);
    }
    
    return successResponse(res, { 
      status: 'success',
      message: 'Product updated successfully',
      product 
    });
  } catch (err) {
    console.error('Error updating product:', err);
    return errorResponse(res, 'Failed to update product', 400);
  }
};

export const updateStock = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { change_type, quantity, notes } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return errorResponse(res, 'User not authenticated', 401);
    }
    
    const product = await Product.findById(id);
    if (!product) return errorResponse(res, 'Product not found', 404);
    
    const oldQuantity = product.quantity;
    let newQuantity = oldQuantity;
    
    switch (change_type) {
      case 'restock':
      case 'return':
        newQuantity = oldQuantity + quantity;
        break;
      case 'sale':
        newQuantity = oldQuantity - quantity;
        if (newQuantity < 0) {
          return errorResponse(res, 'Insufficient stock', 400);
        }
        break;
      default:
        return errorResponse(res, 'Invalid change type', 400);
    }
    
    product.quantity = newQuantity;
    product.updatedAt = new Date();
    await product.save();
    
    // Create inventory log
    await InventoryLog.create({
      productId: id,
      userId,
      changeType: change_type,
      quantityChanged: quantity,
      oldQuantity,
      newQuantity,
      notes
    });
    
    // Check if low stock alert needed
    await checkLowStockThreshold(id);
    
    return successResponse(res, {
      status: 'success',
      message: 'Stock updated successfully',
      product: await Product.findById(id).populate('categoryId', 'name')
    });
  } catch (err) {
    console.error('Error updating stock:', err);
    return errorResponse(res, 'Failed to update stock', 400);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete related records
    await InventoryLog.deleteMany({ productId: id });
    await StockAlert.deleteOne({ productId: id });
    
    const product = await Product.findByIdAndDelete(id);
    if (!product) return errorResponse(res, 'Product not found', 404);
    
    return successResponse(res, { 
      status: 'success',
      message: 'Product deleted successfully',
      product 
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return errorResponse(res, 'Failed to delete product', 400);
  }
};
