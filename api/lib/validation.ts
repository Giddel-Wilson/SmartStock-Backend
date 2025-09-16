import Joi from 'joi'

// User validation schemas
export const userSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid('manager', 'staff').required(),
  departmentId: Joi.string().uuid().allow(null, ''),
})

export const userUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('manager', 'staff').optional(),
  departmentId: Joi.string().uuid().allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
})

// Product validation schemas  
export const productSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  sku: Joi.string().min(1).max(100).required(),
  price: Joi.number().positive().required(),
  categoryId: Joi.string().uuid().allow(null, ''),
  departmentId: Joi.string().uuid().allow(null, ''),
  minimumStockLevel: Joi.number().integer().min(0).required(),
  supplier: Joi.string().max(200).allow(null, ''),
  description: Joi.string().max(1000).allow(null, ''),
  imageUrl: Joi.string().uri().allow(null, ''),
  isActive: Joi.boolean().default(true),
})

export const productUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(200).optional(),
  sku: Joi.string().min(1).max(100).optional(),
  price: Joi.number().positive().optional(),
  categoryId: Joi.string().uuid().allow(null, '').optional(),
  departmentId: Joi.string().uuid().allow(null, '').optional(),
  minimumStockLevel: Joi.number().integer().min(0).optional(),
  supplier: Joi.string().max(200).allow(null, '').optional(),
  description: Joi.string().max(1000).allow(null, '').optional(),
  imageUrl: Joi.string().uri().allow(null, '').optional(),
  isActive: Joi.boolean().optional(),
})

// Inventory validation schemas
export const inventoryUpdateSchema = Joi.object({
  quantity: Joi.number().integer().min(0).required(),
  reason: Joi.string().min(1).max(500).required(),
})

// Category validation schemas
export const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow(null, ''),
})

// Department validation schemas
export const departmentSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow(null, ''),
})

// Auth validation schemas
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
})

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('manager', 'staff').default('staff'),
  departmentId: Joi.string().uuid().allow(null, ''),
})