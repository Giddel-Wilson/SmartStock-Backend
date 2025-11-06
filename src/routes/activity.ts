import express from 'express';
import { getActivityLogs, getActivityLogsByUser } from '../controllers/activityController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// Get all activity logs with filtering
router.get('/', authenticateJWT, getActivityLogs);

// Get activity logs for a specific user
router.get('/user/:userId', authenticateJWT, getActivityLogsByUser);

export default router;
