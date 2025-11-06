import { Router } from 'express';
import { getProducts, getProduct, getLowStockProducts, createProduct, updateProduct, updateStock, deleteProduct } from '../controllers/productController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Get all products with optional filtering
router.get('/products', authenticateJWT, getProducts);

// Get low stock products
router.get('/products/low-stock', authenticateJWT, getLowStockProducts);

// Get product by ID
router.get('/products/:id', authenticateJWT, getProduct);

// Create product
router.post('/products', authenticateJWT, createProduct);

// Update product
router.put('/products/:id', authenticateJWT, updateProduct);

// Update stock (restock, sale, return)
router.patch('/products/:id/stock', authenticateJWT, updateStock);

// Delete product
router.delete('/products/:id', authenticateJWT, deleteProduct);

export default router;
