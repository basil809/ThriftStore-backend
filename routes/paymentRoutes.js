import express from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import crypto from 'crypto';
import Order from '../models/order.js';
import { sendPurchaseEvent } from '../utils/metaConversionsApi.js';

const router = express.Router();

const verifyWebhookSignature = (req) => {
    const secret = process.env.PAYCLOUD_WEBHOOK_SECRET;
    if (!secret) {
        return true;
    }

    const signatureHeader = req.headers['stripe-signature'] || req.headers['x-paycloud-signature'] || req.headers['paycloud-signature'];
    if (!signatureHeader) {
        console.warn('Missing webhook signature header');
        return false;
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    let signatureValue = signatureHeader;

    const match = String(signatureHeader).match(/v1=([^,]+)/);
    if (match) {
        signatureValue = match[1];
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signatureValue));
    } catch (err) {
        return false;
    }
};

const extractTransactionReference = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    const lookupKeys = ['transactionId', 'transaction_id', 'merchant_reference', 'reference', 'orderId', 'order_id'];
    for (const key of lookupKeys) {
        if (payload[key]) return String(payload[key]);
    }

    const description = payload.description || payload.note || '';
    const orderIdMatch = description.match(/RR-\d{4}/);
    if (orderIdMatch) return orderIdMatch[0];

    return null;
};

router.post('/paycloud/stk-push', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid or malformed token' });
        }

        const {
            phone,
            amount,
            description,
            billingDetails,
            items,
            subtotal,
            shippingFee,
            totalAmount
        } = req.body;

        if (!billingDetails || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Billing and cart information are required for payment.' });
        }

        const consumerKey = process.env.PAYCLOUD_CONSUMER_KEY;
        const consumerSecret = process.env.PAYCLOUD_CONSUMER_SECRET;
        const rawBaseUrl = process.env.PAYCLOUD_BASE_URL || 'https://pay.cloud.or.ke';
        const baseUrl = rawBaseUrl.replace(/^https?:\/\/(www\.)?pay\.cloud\.or\.ke/i, 'https://www.pay.cloud.or.ke');

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
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        const tokenData = await tokenResponse.json().catch(() => ({}));
        const tokenPayload = tokenData.data || tokenData;
        const accessToken = tokenPayload.access_token;

        if (!tokenResponse.ok || !accessToken) {
            console.error('PayCloud token error', { status: tokenResponse.status, body: tokenData });
            return res.status(502).json({
                success: false,
                message: 'Unable to authenticate with PayCloud right now.',
                details: tokenData
            });
        }

        const orderId = `RR-${Math.floor(1000 + Math.random() * 9000)}`;
        const transactionId = `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/paycloud/callback`;

        const stkBody = {
            phone: sanitizedPhone,
            amount: Math.round(amountValue),
            description: description || `Retro Rack order ${orderId}`
        };

        if (callbackUrl) stkBody.callback_url = callbackUrl;

        const stkResponse = await fetch(`${baseUrl}/api/payments/mpesa/stkpush`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stkBody)
        });

        const stkData = await stkResponse.json().catch(() => ({}));

        if (!stkResponse.ok) {
            console.error('PayCloud STK response error', { status: stkResponse.status, body: stkData });
            return res.status(502).json({
                success: false,
                message: 'STK push could not be initiated. Please use the manual payment instructions.',
                details: stkData
            });
        }

        const order = new Order({
            user: decoded.id,
            orderId,
            transactionId,
            items,
            billingDetails,
            subtotal,
            shippingFee,
            totalAmount,
            paymentStatus: 'Pending',
            status: 'Pending'
        });

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'STK push initiated successfully. Please complete the prompt on your phone.',
            data: stkData,
            orderId,
            transactionId
        });
    } catch (error) {
        console.error('PayCloud STK error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while trying to start the STK push.'
        });
    }
});

router.post('/paycloud/callback', async (req, res) => {
    try {
        if (!verifyWebhookSignature(req)) {
            return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
        }

        const payload = req.body;
        const transactionRef = extractTransactionReference(payload) || extractTransactionReference(payload.data);
        const eventType = payload.event || payload.type || payload.event_type || payload.status || '';
        const statusValue = payload.status || payload.payment_status || payload.transaction_status || '';

        if (!transactionRef) {
            console.warn('Callback received without identifiable transaction reference', payload);
            return res.status(400).json({ success: false, message: 'Callback missing transaction reference.' });
        }

        const order = await Order.findOne({
            $or: [
                { transactionId: transactionRef },
                { orderId: transactionRef }
            ]
        });

        if (!order) {
            console.warn('No matching order found for PayCloud callback', { transactionRef, payload });
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const callbackState = `${eventType} ${statusValue}`;
        const isSuccess = /success|paid|completed|approved/i.test(callbackState);
        const isFailure = /fail|decline|cancel|rejected|error/i.test(callbackState);

        if (isSuccess) {
            order.paymentStatus = 'Paid';
            order.status = 'Processing';
        } else if (isFailure) {
            order.paymentStatus = 'Failed';
            order.status = 'Cancelled';
        } else {
            order.paymentStatus = 'Pending';
        }

        if (payload.data?.amount) {
            order.totalAmount = Number(payload.data.amount) || order.totalAmount;
        }

        await order.save();

        if (isSuccess) {
            await sendPurchaseEvent(order, req);
        }

        return res.status(200).json({ success: true, message: 'Payment callback processed.', orderId: order.orderId, paymentStatus: order.paymentStatus });
    } catch (error) {
        console.error('PayCloud callback error:', error);
        res.status(500).json({ success: false, message: 'Webhook processing failed.' });
    }
});

router.get('/paycloud/status/:transactionId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid or malformed token' });
        }

        const { transactionId } = req.params;
        if (!transactionId) {
            return res.status(400).json({ success: false, message: 'Transaction ID is required.' });
        }

        const order = await Order.findOne({ transactionId, user: decoded.id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        res.json({
            success: true,
            paymentStatus: order.paymentStatus,
            status: order.status,
            orderId: order.orderId,
            order: {
                orderId: order.orderId,
                transactionId: order.transactionId,
                totalAmount: order.totalAmount,
                status: order.status,
                paymentStatus: order.paymentStatus
            }
        });
    } catch (error) {
        console.error('PayCloud status error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment status.' });
    }
});

export default router;
