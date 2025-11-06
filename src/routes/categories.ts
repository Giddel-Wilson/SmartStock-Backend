import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.get('/categories', authenticateJWT, getCategories);
router.post('/categories', authenticateJWT, createCategory);
router.put('/categories/:id', authenticateJWT, updateCategory);
router.delete('/categories/:id', authenticateJWT, deleteCategory);

export default router;
