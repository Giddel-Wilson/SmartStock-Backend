import { Request, Response } from 'express';
import Department from '../models/Department';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const getDepartments = async (req: AuthRequest, res: Response) => {
  try {
    const departments = await Department.find();
    return successResponse(res, { departments });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch departments', 500);
  }
};

export const createDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const department = await Department.create({ name, description });
    return successResponse(res, { department });
  } catch (err) {
    return errorResponse(res, 'Failed to create department', 400);
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const department = await Department.findByIdAndUpdate(id, updates, { new: true });
    if (!department) return errorResponse(res, 'Department not found', 404);
    return successResponse(res, { department });
  } catch (err) {
    return errorResponse(res, 'Failed to update department', 400);
  }
};

export const deleteDepartment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndDelete(id);
    if (!department) return errorResponse(res, 'Department not found', 404);
    return successResponse(res, { department });
  } catch (err) {
    return errorResponse(res, 'Failed to delete department', 400);
  }
};
