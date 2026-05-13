// Subscription Routes
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// ===============================
// CREATE SUBSCRIPTION
// ===============================
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        // Check if email already exists
        const existingSubscription = await Subscription.findOne({ email });
        if (existingSubscription) {
            return res.status(200).json({ success: true, message: "You are already subscribed!" });
        }

        // Create new subscription
        const newSubscription = new Subscription({ email });
        await newSubscription.save();

        res.status(201).json({ success: true, message: "Subscription successful!" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Failed to create subscription" });
    }
});

export default router;
