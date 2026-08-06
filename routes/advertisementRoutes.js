import express from 'express';
import AdvertisementRequest from '../models/advertisementRequest.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new advertisement request
router.post('/request', async (req, res) => {
    try {
        const { name, email, phone, message } = req.body;

        if (!name || !email || !phone || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const newRequest = new AdvertisementRequest({ name, email, phone, message });
        await newRequest.save();

        res.status(201).json({ success: true, message: 'Advertisement request submitted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to submit advertisement request' });
    }
});

// Get all advertisement requests (admin only)
router.get('/admin/requests', verifyAdmin, async (req, res) => {
    try {
        const requests = await AdvertisementRequest.find().sort({ createdAt: -1 });
        res.json({ success: true, requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to retrieve advertisement requests' });
    }
});

export default router;
