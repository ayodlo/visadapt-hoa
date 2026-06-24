import { Router } from 'express';
import { register, login, me, updateProfile, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);

export default router;
