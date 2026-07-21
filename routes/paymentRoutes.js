import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/paycloud/stk-push', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET);

        const { phone, amount, description } = req.body;
        const consumerKey = process.env.PAYCLOUD_CONSUMER_KEY;
        const consumerSecret = process.env.PAYCLOUD_CONSUMER_SECRET;
        const baseUrl = process.env.PAYCLOUD_BASE_URL || 'https://pay.cloud.or.ke';

        if (!consumerKey || !consumerSecret) {
            return res.status(500).json({
                success: false,
                message: 'PayCloud credentials are not configured on the server.'
            });
        }

        const normalizedPhone = String(phone || '').trim();
        const sanitizedPhone = normalizedPhone.startsWith('254')
            ? normalizedPhone
            : normalizedPhone.replace(/^0/, '254');

        if (!sanitizedPhone || !/^(254)\d{9}$/.test(sanitizedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid phone number in the format 2547XXXXXXXX.'
            });
        }

        const amountValue = Number(amount || 0);
        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid payment amount.'
            });
        }

        const tokenResponse = await fetch(`${baseUrl}/api/oauth/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        });

        const tokenData = await tokenResponse.json().catch(() => ({}));

        if (!tokenResponse.ok || !tokenData.access_token) {
            return res.status(502).json({
                success: false,
                message: 'Unable to authenticate with PayCloud right now.',
                details: tokenData
            });
        }

        const stkResponse = await fetch(`${baseUrl}/api/payments/mpesa/stkpush`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: sanitizedPhone,
                amount: Math.round(amountValue),
                description: description || 'Retro Rack purchase'
            })
        });

        const stkData = await stkResponse.json().catch(() => ({}));

        if (!stkResponse.ok) {
            return res.status(502).json({
                success: false,
                message: 'STK push could not be initiated. Please use the manual payment instructions.',
                details: stkData
            });
        }

        return res.status(200).json({
            success: true,
            message: 'STK push initiated successfully. Please complete the prompt on your phone.',
            data: stkData
        });
    } catch (error) {
        console.error('PayCloud STK error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while trying to start the STK push.'
        });
    }
});

export default router;
