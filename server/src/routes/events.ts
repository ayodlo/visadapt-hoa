import { Router } from 'express';
import { listEvents, createEvent, deleteEvent } from '../controllers/eventsController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(authenticate);

router.get('/', listEvents);
router.post('/', requireRole('ADMIN', 'BOARD_MEMBER'), createEvent);
router.delete('/:id', requireRole('ADMIN', 'BOARD_MEMBER'), deleteEvent);

export default router;
