import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.get('/users', authenticateJWT, getUsers);
router.post('/users', authenticateJWT, createUser);
router.put('/users/:id', authenticateJWT, updateUser);
router.delete('/users/:id', authenticateJWT, deleteUser);

export default router;
