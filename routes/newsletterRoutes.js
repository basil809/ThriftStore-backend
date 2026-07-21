// Routes/newsletter.js
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import Subscription from '../models/subscription.js';
import Newsletter from '../models/Newsletter.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

const router = express.Router();

// ===============================
// MULTER FILE UPLOAD SETUP (SECURE)
// ===============================
const storage = multer.memoryStorage();

// File filter to restrict uploads strictly to images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Max 5MB file size limit
});

// ===============================
// NODEMAILER TRANSPORTER CONFIG
// ===============================
// Configure this with your real SMTP provider (e.g., SendGrid, Mailgun, or Gmail)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP Error:', error);
    } else {
        console.log('SMTP Server Ready');
    }
});

// ===============================
// POST: CREATE & SEND NEWSLETTER (ADMIN ONLY)
// ===============================
router.post('/send', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        const { subject, message, sender} = req.body;
        
        // 1. Input Validation
        if (!subject || !message || !sender) {
            return res.status(400).json({ success: false, message: "Subject, Message, and Sender are required." });
        }

        // Get uploaded image URL if exists
        const imageUrl = req.file ? await uploadToCloudinary(req.file.buffer, 'newsletters') : null;

        // 2. Fetch all subscribers
        const subscribers = await Subscription.find({}, 'email');
        if (subscribers.length === 0) {
            return res.status(400).json({ success: false, message: "No subscribers found to send this newsletter to." });
        }

        // Map documents down to an array of string emails
        const recipientList = subscribers.map(sub => sub.email);

        // 3. Prepare Email Options
        const mailOptions = {
            from: `"Retro Rack Thriftstore" <${process.env.SMTP_USER}>`,
            // Bcc is critical for privacy: subscribers won't see each other's emails
            bcc: recipientList, 
            subject: subject,
            text: message, // Plain text fallback
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #ff5722; text-align: center;">Retro Rack Thriftstore</h2>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <h3>${subject}</h3>
                    <p style="white-space: pre-line; line-height: 1.6; color: #333;">${message}</p>
                    ${imageUrl ? `<div style="text-align: center; margin-top: 20px;"><img src="${imageUrl}" alt="Newsletter Image" style="max-width: 100%; height: auto; border-radius: 5px;"/></div>` : ''}
                    <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;">
                    <p style="font-size: 11px; color: #777; text-align: center;">
                        You received this email because you subscribed to Retro Rack Thriftstore. <br>
                        <a href="${process.env.BASE_URL}/unsubscribe" style="color: #ff5722;">Unsubscribe</a> at any time.
                    </p>
                </div>
            `
        };

        // If there's an image attachment, include it in the email bundle payload safely
        if (req.file) {
            mailOptions.attachments = [{
                filename: req.file.originalname,
                content: req.file.buffer
            }];
        }

        // 4. Fire the emails out
        // Ensure SMTP credentials are configured before attempting to send
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('Newsletter Error: SMTP credentials missing');
            return res.status(500).json({ success: false, message: 'SMTP credentials not configured on server.' });
        }

        await transporter.sendMail(mailOptions);

        // 5. Save copy to DB for Admin History logs
        const newNewsletter = new Newsletter({
            subject,
            message,
            imageUrl,
            sentBy: req.user.id // Pulled out of the verifyAdmin middleware payload token
        });
        await newNewsletter.save();

        res.status(201).json({ 
            success: true, 
            message: `Newsletter successfully dispatched to ${recipientList.length} subscribers!` 
        });

    } catch (error) {
        console.error("Newsletter Error:", error);
        res.status(500).json({ success: false, message: "Internal server error while processing newsletter distribution." });
    }
});

export default router;