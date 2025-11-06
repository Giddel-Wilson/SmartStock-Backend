import { Router } from 'express';
import { login, logout } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/auth/login', login);
router.post('/auth/logout', authenticateJWT, logout);

export default router;
