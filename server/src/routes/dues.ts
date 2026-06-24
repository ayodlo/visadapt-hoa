import { Router } from 'express';
import { listDues, createDues, updateDuesStatus } from '../controllers/duesController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(authenticate);

router.get('/', listDues);
router.post('/', requireRole('ADMIN'), createDues);
router.patch('/:id/status', requireRole('ADMIN', 'BOARD_MEMBER'), updateDuesStatus);

export default router;
