import { Router } from 'express';
import { listAnnouncements, createAnnouncement } from '../controllers/announcementsController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', authenticate, listAnnouncements);
router.post('/', authenticate, requireRole('ADMIN', 'BOARD_MEMBER'), createAnnouncement);

export default router;
