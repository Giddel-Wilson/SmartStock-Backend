import { Request, Response } from 'express';
import Category from '../models/Category';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await Category.find();
    return successResponse(res, { categories });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const category = await Category.create({ name, description });
    return successResponse(res, { category });
  } catch (err) {
    return errorResponse(res, 'Failed to create category', 400);
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const category = await Category.findByIdAndUpdate(id, updates, { new: true });
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, { category });
  } catch (err) {
    return errorResponse(res, 'Failed to update category', 400);
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, { category });
  } catch (err) {
    return errorResponse(res, 'Failed to delete category', 400);
  }
};
