import { Router } from 'express';
import { listPolls, createPoll, castVote } from '../controllers/pollsController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(authenticate);

router.get('/', listPolls);
router.post('/', requireRole('ADMIN', 'BOARD_MEMBER'), createPoll);
router.post('/:id/vote', castVote);

export default router;
