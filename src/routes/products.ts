import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.get('/products', authenticateJWT, getProducts);
router.post('/products', authenticateJWT, createProduct);
router.put('/products/:id', authenticateJWT, updateProduct);
router.delete('/products/:id', authenticateJWT, deleteProduct);

export default router;
