import express from 'express';
import { getStockAlerts, getUnsentAlerts, markAlertAsSent, deleteAlert } from '../controllers/alertController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all stock alerts
router.get('/', authenticateJWT, getStockAlerts);

// Get unsent alerts
router.get('/unsent', authenticateJWT, getUnsentAlerts);

// Mark alert as sent
router.patch('/:id/sent', authenticateJWT, markAlertAsSent);

// Delete alert
router.delete('/:id', authenticateJWT, deleteAlert);

export default router;
