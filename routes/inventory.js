const express = require('express');
const Joi = require('joi');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { activityLogger } = require('../middleware/activityLogger');

const router = express.Router();

// Helper function to check if user can modify a product's inventory based on department
const canModifyProductInventory = async (userId, productId) => {
    try {
        const result = await db.query(`
            SELECT p.department_id as product_dept, u.department_id as user_dept, u.role
            FROM products p, users u
            WHERE p.id = $1 AND u.id = $2
        `, [productId, userId]);

        if (result.rows.length === 0) {
            return false;
        }

        const { product_dept, user_dept, role } = result.rows[0];

        // Managers can modify any product's inventory
        if (role === 'manager') {
            return true;
        }

        // Staff can only modify products in their department
        // If product has no department assigned, only managers can modify it
        if (!product_dept) {
            return false;
        }

        return product_dept === user_dept;
    } catch (error) {
        console.error('Error checking product access:', error);
        return false;
    }
};

// Validation schemas
const inventoryUpdateSchema = Joi.object({
    productId: Joi.string().uuid().required(),
    changeType: Joi.string().valid('restock', 'sale', 'adjustment', 'return').required(),
    quantityChanged: Joi.number().integer().required(),
    reason: Joi.string().max(500).optional(),
    referenceNumber: Joi.string().max(100).optional()
});

const bulkUpdateSchema = Joi.object({
    updates: Joi.array().items(inventoryUpdateSchema).min(1).max(100).required()
});

// Helper function to check low stock and create alerts
const checkLowStock = async (productId) => {
    try {
        const result = await db.query(`
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 AND p.quantity_in_stock <= p.minimum_stock_level AND p.is_active = true
        `, [productId]);

        if (result.rows.length > 0) {
            const product = result.rows[0];
            
            // Check if alert already exists for this product
            const existingAlert = await db.query(`
                SELECT id FROM stock_alerts 
                WHERE product_id = $1 AND alert_sent = false
            `, [productId]);

            if (existingAlert.rows.length === 0) {
                // Create new alert
                const message = `Low stock alert: ${product.name} (SKU: ${product.sku}) has ${product.quantity_in_stock} units remaining (threshold: ${product.minimum_stock_level})`;
                
                await db.query(`
                    INSERT INTO stock_alerts (product_id, message)
                    VALUES ($1, $2)
                `, [productId, message]);

                // Send real-time notification
                if (global.wsConnections) {
                    const managerResult = await db.query(`
                        SELECT id FROM users WHERE role = 'manager' AND is_active = true
                    `);

                    for (const manager of managerResult.rows) {
                        const ws = global.wsConnections.get(manager.id);
                        if (ws && ws.readyState === 1) {
                            ws.send(JSON.stringify({
                                type: 'low_stock_alert',
                                data: {
                                    productId: product.id,
                                    productName: product.name,
                                    sku: product.sku,
                                    currentQuantity: product.quantity_in_stock,
                                    threshold: product.minimum_stock_level,
                                    category: product.category_name,
                                    message
                                }
                            }));
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking low stock:', error);
    }
};

// @route   POST /api/inventory/update
// @desc    Update inventory for a single product
// @access  Private
router.post('/update', authenticateToken, activityLogger('UPDATE_INVENTORY', 'inventory'), async (req, res) => {
    try {
        const { error, value } = inventoryUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { productId, changeType, quantityChanged, reason, referenceNumber } = value;

        // Check if user can modify this product's inventory based on department
        const canModify = await canModifyProductInventory(req.user.id, productId);
        if (!canModify) {
            return res.status(403).json({ 
                error: 'You do not have permission to modify this product\'s inventory. Products can only be modified by users in the same department.' 
            });
        }

        // Start transaction
        await db.query('BEGIN');

        try {
            // Get current product info
            const productResult = await db.query(`
                SELECT quantity_in_stock, name, sku FROM products WHERE id = $1 AND is_active = true
            `, [productId]);

            if (productResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Product not found or inactive' });
            }

            const product = productResult.rows[0];
            const quantityBefore = product.quantity_in_stock;
            let quantityAfter;

            // Calculate new quantity based on change type
            switch (changeType) {
                case 'restock':
                case 'return':
                    quantityAfter = quantityBefore + Math.abs(quantityChanged);
                    break;
                case 'sale':
                    quantityAfter = quantityBefore - Math.abs(quantityChanged);
                    break;
                case 'adjustment':
                    // For adjustments, quantityChanged can be positive or negative
                    quantityAfter = quantityBefore + quantityChanged;
                    break;
                default:
                    await db.query('ROLLBACK');
                    return res.status(400).json({ error: 'Invalid change type' });
            }

            // Validate new quantity
            if (quantityAfter < 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Insufficient stock. Current quantity: ${quantityBefore}, requested change: ${quantityChanged}` 
                });
            }

            // Update product quantity
            await db.query(`
                UPDATE products 
                SET quantity_in_stock = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $2
            `, [quantityAfter, productId]);

            // Log the inventory change
            const actualQuantityChanged = quantityAfter - quantityBefore;
            await db.query(`
                INSERT INTO inventory_logs (product_id, user_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_number)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (product_id, user_id, type, created_at) DO UPDATE 
                SET quantity_change = EXCLUDED.quantity_change, previous_quantity = EXCLUDED.previous_quantity, new_quantity = EXCLUDED.new_quantity, reason = EXCLUDED.reason, reference_number = EXCLUDED.reference_number
            `, [productId, req.user.id, changeType, actualQuantityChanged, quantityBefore, quantityAfter, reason, referenceNumber]);

            await db.query('COMMIT');

            // Check for low stock
            await checkLowStock(productId);

            // Send real-time update to connected clients
            if (global.wsConnections) {
                const updateData = {
                    type: 'inventory_update',
                    data: {
                        productId,
                        productName: product.name,
                        sku: product.sku,
                        quantityBefore,
                        quantityAfter,
                        changeType,
                        quantityChanged: actualQuantityChanged,
                        updatedBy: req.user.name,
                        timestamp: new Date()
                    }
                };

                global.wsConnections.forEach((ws) => {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify(updateData));
                    }
                });
            }

            res.json({
                message: 'Inventory updated successfully',
                update: {
                    productId,
                    productName: product.name,
                    quantityBefore,
                    quantityAfter,
                    quantityChanged: actualQuantityChanged,
                    changeType
                }
            });
        } catch (innerError) {
            await db.query('ROLLBACK');
            throw innerError;
        }
    } catch (error) {
        console.error('Update inventory error:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// @route   POST /api/inventory/bulk-update
// @desc    Update inventory for multiple products
// @access  Private
router.post('/bulk-update', authenticateToken, activityLogger('BULK_UPDATE_INVENTORY', 'inventory'), async (req, res) => {
    try {
        const { error, value } = bulkUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { updates } = value;
        const results = [];
        const errors = [];

        // Start transaction
        await db.query('BEGIN');

        try {
            for (const [index, update] of updates.entries()) {
                try {
                    const { productId, changeType, quantityChanged, reason, referenceNumber } = update;

                    // Check modification permission
                    const canModify = await canModifyProductInventory(req.user.id, productId);
                    if (!canModify) {
                        errors.push({
                            index,
                            productId,
                            error: 'You do not have permission to modify this product\'s inventory'
                        });
                        continue;
                    }

                    // Get current product info
                    const productResult = await db.query(`
                        SELECT quantity_in_stock, name, sku FROM products WHERE id = $1 AND is_active = true
                    `, [productId]);

                    if (productResult.rows.length === 0) {
                        errors.push({
                            index,
                            productId,
                            error: 'Product not found or inactive'
                        });
                        continue;
                    }

                    const product = productResult.rows[0];
                    const quantityBefore = product.quantity_in_stock;
                    let quantityAfter;

                    // Calculate new quantity
                    switch (changeType) {
                        case 'restock':
                        case 'return':
                            quantityAfter = quantityBefore + Math.abs(quantityChanged);
                            break;
                        case 'sale':
                            quantityAfter = quantityBefore - Math.abs(quantityChanged);
                            break;
                        case 'adjustment':
                            quantityAfter = quantityBefore + quantityChanged;
                            break;
                        default:
                            errors.push({
                                index,
                                productId,
                                error: 'Invalid change type'
                            });
                            continue;
                    }

                    // Validate new quantity
                    if (quantityAfter < 0) {
                        errors.push({
                            index,
                            productId,
                            error: `Insufficient stock. Current: ${quantityBefore}, requested change: ${quantityChanged}`
                        });
                        continue;
                    }

                    // Update product quantity
                    await db.query(`
                        UPDATE products 
                        SET quantity_in_stock = $1, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = $2
                    `, [quantityAfter, productId]);

                    // Log the inventory change
                    const actualQuantityChanged = quantityAfter - quantityBefore;
                    await db.query(`
                        INSERT INTO inventory_logs (product_id, user_id, type, quantity_change, previous_quantity, new_quantity, reason, reference_number)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (product_id, user_id, type, created_at) DO UPDATE 
                        SET quantity_change = EXCLUDED.quantity_change, previous_quantity = EXCLUDED.previous_quantity, new_quantity = EXCLUDED.new_quantity, reason = EXCLUDED.reason, reference_number = EXCLUDED.reference_number
                    `, [productId, req.user.id, changeType, actualQuantityChanged, quantityBefore, quantityAfter, reason, referenceNumber]);

                    results.push({
                        index,
                        productId,
                        productName: product.name,
                        quantityBefore,
                        quantityAfter,
                        quantityChanged: actualQuantityChanged,
                        changeType,
                        success: true
                    });

                } catch (updateError) {
                    errors.push({
                        index,
                        productId: update.productId,
                        error: updateError.message
                    });
                }
            }

            if (errors.length > 0 && results.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    error: 'All updates failed',
                    errors
                });
            }

            await db.query('COMMIT');

            // Check for low stock on all updated products
            for (const result of results) {
                await checkLowStock(result.productId);
            }

            res.json({
                message: `Bulk inventory update completed. ${results.length} successful, ${errors.length} failed.`,
                results,
                errors: errors.length > 0 ? errors : undefined
            });
        } catch (innerError) {
            await db.query('ROLLBACK');
            throw innerError;
        }
    } catch (error) {
        console.error('Bulk update inventory error:', error);
        res.status(500).json({ error: 'Failed to perform bulk inventory update' });
    }
});

// @route   GET /api/inventory/alerts
// @desc    Get stock alerts
// @access  Private
router.get('/alerts', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        if (unreadOnly === 'true') {
            whereClause = 'WHERE sa.is_read = false';
        }

        const result = await db.query(`
            SELECT sa.*, p.name as product_name, p.sku, p.quantity, p.low_stock_threshold
            FROM stock_alerts sa
            JOIN products p ON sa.product_id = p.id
            ${whereClause}
            ORDER BY sa.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total 
            FROM stock_alerts sa
            JOIN products p ON sa.product_id = p.id
            ${whereClause}
        `);

        res.json({
            alerts: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// @route   PUT /api/inventory/alerts/:id/read
// @desc    Mark alert as read
// @access  Private
router.put('/alerts/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            UPDATE stock_alerts 
            SET is_read = true 
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        res.json({
            message: 'Alert marked as read',
            alert: result.rows[0]
        });
    } catch (error) {
        console.error('Mark alert read error:', error);
        res.status(500).json({ error: 'Failed to mark alert as read' });
    }
});

// @route   GET /api/inventory/summary
// @desc    Get inventory summary statistics
// @access  Private
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { departmentId } = req.query;
        const { user } = req;

        // Build department filter based on user role
        let departmentFilter = '';
        let departmentParams = [];

        if (user.role === 'staff') {
            if (!user.department_id) {
                return res.status(403).json({ 
                    error: 'Access denied. Staff must be assigned to a department to view inventory summary.' 
                });
            }
            departmentFilter = 'AND p.department_id = $1';
            departmentParams = [user.department_id];
        } else if (departmentId) {
            // Managers can filter by specific department
            departmentFilter = 'AND p.department_id = $1';
            departmentParams = [departmentId];
        }

        // Get general stats
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
                COUNT(CASE WHEN quantity_in_stock <= minimum_stock_level AND is_active = true THEN 1 END) as low_stock_products,
                COUNT(CASE WHEN quantity_in_stock = 0 AND is_active = true THEN 1 END) as out_of_stock_products,
                SUM(CASE WHEN is_active = true THEN quantity_in_stock * price ELSE 0 END) as total_inventory_value
            FROM products p
            WHERE 1=1 ${departmentFilter}
        `, departmentParams);

        // Get recent inventory movements
        const recentMovements = await db.query(`
            SELECT il.*, p.name as product_name, p.sku, u.name as user_name, d.name as department_name
            FROM inventory_logs il
            JOIN products p ON il.product_id = p.id
            JOIN users u ON il.user_id = u.id
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE 1=1 ${departmentFilter}
            ORDER BY il.created_at DESC
            LIMIT 10
        `, departmentParams);

        // Get low stock products
        const lowStockProducts = await db.query(`
            SELECT p.*, c.name as category_name, d.name as department_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE p.quantity_in_stock <= p.minimum_stock_level AND p.is_active = true ${departmentFilter}
            ORDER BY (p.quantity_in_stock::float / NULLIF(p.minimum_stock_level, 0)) ASC
            LIMIT 10
        `, departmentParams);

        // Get top selling products (based on recent sales)
        const topSelling = await db.query(`
            SELECT p.name, p.sku, SUM(ABS(il.quantity_change)) as total_sold, d.name as department_name
            FROM inventory_logs il
            JOIN products p ON il.product_id = p.id
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE il.type = 'sale' AND il.created_at >= NOW() - INTERVAL '30 days' ${departmentFilter}
            GROUP BY p.id, p.name, p.sku, d.name
            ORDER BY total_sold DESC
            LIMIT 10
        `, departmentParams);

        res.json({
            stats: statsResult.rows[0],
            recentMovements: recentMovements.rows,
            lowStockProducts: lowStockProducts.rows,
            topSellingProducts: topSelling.rows
        });
    } catch (error) {
        console.error('Get inventory summary error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory summary' });
    }
});

module.exports = router;
