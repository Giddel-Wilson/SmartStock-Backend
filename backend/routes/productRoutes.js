const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const productModel = require('../models/productModel');
const activityLogModel = require('../models/activityLogModel');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// Get all products with optional filtering
router.get('/', auth, async (req, res) => {
  try {
    const filters = {
      category_id: req.query.category_id ? parseInt(req.query.category_id) : undefined,
      low_stock: req.query.low_stock === 'true',
      search: req.query.search,
      sort_by: req.query.sort_by,
      sort_direction: req.query.sort_direction
    };

    const products = await productModel.findAll(filters);
    
    return res.status(200).json({
      status: 'success',
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving products'
    });
  }
});

// Get low stock products
router.get('/low-stock', auth, async (req, res) => {
  try {
    const lowStockProducts = await productModel.getLowStockProducts();
    
    return res.status(200).json({
      status: 'success',
      count: lowStockProducts.length,
      products: lowStockProducts
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving low stock products'
    });
  }
});

// Get product by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = await productModel.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving product'
    });
  }
});

// Create product
router.post('/', 
  auth,
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('category_id').optional().isInt().withMessage('Category ID must be an integer'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
    body('low_stock_threshold').optional().isInt({ min: 1 }).withMessage('Low stock threshold must be a positive integer'),
    body('description').optional()
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }
      
      // Check if SKU already exists
      const existingSku = await productModel.findBySku(req.body.sku);
      if (existingSku) {
        return res.status(400).json({
          status: 'error',
          message: 'Product with this SKU already exists'
        });
      }
      
      const productData = {
        ...req.body,
        created_by: req.user.id
      };
      
      // Create product
      const newProduct = await productModel.create(productData);
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'CREATE_PRODUCT',
        details: `Created new product: ${newProduct.name} (SKU: ${newProduct.sku})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(201).json({
        status: 'success',
        message: 'Product created successfully',
        product: newProduct
      });
    } catch (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while creating product'
      });
    }
  }
);

// Update product details (not quantity)
router.put('/:id', 
  auth,
  [
    body('name').optional().notEmpty().withMessage('Product name cannot be empty'),
    body('sku').optional().notEmpty().withMessage('SKU cannot be empty'),
    body('category_id').optional().isInt().withMessage('Category ID must be an integer'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
    body('low_stock_threshold').optional().isInt({ min: 1 }).withMessage('Low stock threshold must be a positive integer'),
    body('description').optional()
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }
      
      const productId = parseInt(req.params.id);
      
      // Check if product exists
      const existingProduct = await productModel.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({
          status: 'error',
          message: 'Product not found'
        });
      }
      
      // Check if SKU is being changed and if it already exists
      if (req.body.sku && req.body.sku !== existingProduct.sku) {
        const skuExists = await productModel.findBySku(req.body.sku);
        if (skuExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Another product with this SKU already exists'
          });
        }
      }
      
      // Update product
      const updatedProduct = await productModel.update(
        productId, 
        req.body,
        req.user.id
      );
      
      // Log activity
      await activityLogModel.logActivity({
        user_id: req.user.id,
        action: 'UPDATE_PRODUCT',
        details: `Updated product: ${updatedProduct.name} (ID: ${productId})`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'Product updated successfully',
        product: updatedProduct
      });
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while updating product'
      });
    }
  }
);

// Update product quantity (restock, sale, etc.)
router.post('/:id/update-quantity', 
  auth,
  [
    body('change_type').isIn(['restock', 'sale', 'edit', 'return']).withMessage('Invalid change type'),
    body('quantity_changed').isInt({ min: -10000, max: 10000 }).withMessage('Quantity change must be an integer between -10000 and 10000'),
    body('notes').optional()
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          errors: errors.array() 
        });
      }
      
      const productId = parseInt(req.params.id);
      const { change_type, quantity_changed, notes } = req.body;
      
      // Update product quantity
      try {
        const updatedProduct = await productModel.updateQuantity(
          productId,
          quantity_changed,
          req.user.id,
          change_type,
          notes
        );
        
        // Log activity
        let actionDetails = '';
        if (change_type === 'restock') {
          actionDetails = `Restocked ${quantity_changed} units of ${updatedProduct.name} (ID: ${productId})`;
        } else if (change_type === 'sale') {
          actionDetails = `Sold ${Math.abs(quantity_changed)} units of ${updatedProduct.name} (ID: ${productId})`;
        } else {
          actionDetails = `Updated quantity by ${quantity_changed} units for ${updatedProduct.name} (ID: ${productId})`;
        }
        
        await activityLogModel.logActivity({
          user_id: req.user.id,
          action: `${change_type.toUpperCase()}_INVENTORY`,
          details: actionDetails,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        });
        
        return res.status(200).json({
          status: 'success',
          message: 'Product quantity updated successfully',
          product: updatedProduct
        });
      } catch (error) {
        if (error.message === 'Product not found') {
          return res.status(404).json({
            status: 'error',
            message: 'Product not found'
          });
        } else if (error.message === 'Cannot reduce stock below zero') {
          return res.status(400).json({
            status: 'error',
            message: 'Cannot reduce stock below zero'
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating product quantity:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error while updating product quantity'
      });
    }
  }
);

// Delete product (managers only)
router.delete('/:id', auth, roleCheck('manager'), async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    // Check if product exists
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }
    
    // Delete product
    const deleteResult = await productModel.delete(productId);
    
    // Log activity
    await activityLogModel.logActivity({
      user_id: req.user.id,
      action: 'DELETE_PRODUCT',
      details: `${deleteResult.softDelete ? 'Soft deleted' : 'Deleted'} product: ${product.name} (ID: ${productId})`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    return res.status(200).json({
      status: 'success',
      message: `Product ${deleteResult.softDelete ? 'deactivated' : 'deleted'} successfully`,
      softDelete: deleteResult.softDelete
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while deleting product'
    });
  }
});

module.exports = router;