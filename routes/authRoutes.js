// routes/authRoutes.js
import express from 'express';
import { adminLogin } from '../controllers/authController.js';

const router = express.Router();

// Admin Login
router.post('/admin-login', adminLogin);


export default router;