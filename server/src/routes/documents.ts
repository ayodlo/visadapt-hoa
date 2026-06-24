import { Router } from 'express';
import { listDocuments, uploadDocument, downloadDocument, deleteDocument } from '../controllers/documentsController';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', listDocuments);
router.get('/:id/download', downloadDocument);
router.post('/', requireRole('ADMIN', 'BOARD_MEMBER'), upload.single('file'), uploadDocument);
router.delete('/:id', requireRole('ADMIN', 'BOARD_MEMBER'), deleteDocument);

export default router;
