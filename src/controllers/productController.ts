import { Request, Response } from 'express';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = await Product.find().populate('categoryId').populate('departmentId');
    return successResponse(res, { products });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch products', 500);
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { name, sku, quantity, unitPrice, categoryId, departmentId } = req.body;
    const product = await Product.create({ name, sku, quantity, unitPrice, categoryId, departmentId });
    return successResponse(res, { product });
  } catch (err) {
    return errorResponse(res, 'Failed to create product', 400);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const product = await Product.findByIdAndUpdate(id, updates, { new: true });
    if (!product) return errorResponse(res, 'Product not found', 404);
    return successResponse(res, { product });
  } catch (err) {
    return errorResponse(res, 'Failed to update product', 400);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) return errorResponse(res, 'Product not found', 404);
    return successResponse(res, { product });
  } catch (err) {
    return errorResponse(res, 'Failed to delete product', 400);
  }
};
