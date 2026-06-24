import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import dashboardRouter from './dashboard';
import announcementsRouter from './announcements';
import usersRouter from './users';
import maintenanceRouter from './maintenance';
import eventsRouter from './events';
import pollsRouter from './polls';
import duesRouter from './dues';
import documentsRouter from './documents';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/dashboard', dashboardRouter);
router.use('/announcements', announcementsRouter);
router.use('/users', usersRouter);
router.use('/maintenance', maintenanceRouter);
router.use('/events', eventsRouter);
router.use('/polls', pollsRouter);
router.use('/dues', duesRouter);
router.use('/documents', documentsRouter);

export default router;
