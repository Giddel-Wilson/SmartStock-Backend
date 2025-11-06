import express from 'express';
import { getInventoryLogs, getInventoryLogsByProduct, getInventoryStats } from '../controllers/inventoryController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all inventory logs with filtering
router.get('/logs', authenticateJWT, getInventoryLogs);

// Get inventory logs for a specific product
router.get('/logs/product/:productId', authenticateJWT, getInventoryLogsByProduct);

// Get inventory statistics
router.get('/stats', authenticateJWT, getInventoryStats);

export default router;
