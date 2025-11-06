import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.get('/departments', authenticateJWT, getDepartments);
router.post('/departments', authenticateJWT, createDepartment);
router.put('/departments/:id', authenticateJWT, updateDepartment);
router.delete('/departments/:id', authenticateJWT, deleteDepartment);

export default router;
