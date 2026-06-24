import { Router } from 'express';
import { listUsers, updateUserRole } from '../controllers/usersController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', listUsers);
router.patch('/:id/role', updateUserRole);

export default router;
