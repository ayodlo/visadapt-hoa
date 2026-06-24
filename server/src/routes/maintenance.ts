import { Router } from 'express';
import { listRequests, createRequest, updateStatus } from '../controllers/maintenanceController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(authenticate);

router.get('/', listRequests);
router.post('/', createRequest);
router.patch('/:id/status', requireRole('ADMIN', 'BOARD_MEMBER'), updateStatus);

export default router;
