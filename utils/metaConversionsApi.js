import crypto from 'crypto';
import fetch from 'node-fetch';
import Order from '../models/order.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

const hash = (value) => {
    const normalized = normalize(value);
    return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : undefined;
};

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').replace(/^0/, '254');

export async function sendPurchaseEvent(order, request = {}) {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v23.0';

    if (!pixelId || !accessToken) {
        console.warn('Meta Conversions API is not configured; Purchase event skipped.');
        return { sent: false, skipped: true };
    }

    const claimed = await Order.updateOne(
        { _id: order._id, metaPixelPurchaseSent: { $ne: true } },
        { $set: { metaPixelPurchaseSent: true } }
    );

    if (claimed.modifiedCount !== 1) {
        return { sent: false, duplicate: true };
    }

    const billing = order.billingDetails || {};
    const phone = normalizePhone(billing.phone);
    const userData = {
        em: hash(billing.email) ? [hash(billing.email)] : undefined,
        ph: hash(phone) ? [hash(phone)] : undefined,
        external_id: hash(order.user?.toString()),
        client_ip_address: request.ip,
        client_user_agent: request.get?.('user-agent')
    };

    Object.keys(userData).forEach((key) => {
        if (!userData[key]) delete userData[key];
    });

    const eventTime = Math.floor(new Date(order.createdAt || Date.now()).getTime() / 1000);
    const payload = {
        data: [{
            event_name: 'Purchase',
            event_time: eventTime,
            event_id: order.orderId,
            action_source: 'website',
            event_source_url: process.env.FRONTEND_URL || undefined,
            user_data: userData,
            custom_data: {
                currency: 'KES',
                value: Number(order.totalAmount || 0),
                order_id: order.orderId,
                content_type: 'product',
                contents: (order.items || []).map((item) => ({
                    id: String(item.productId || ''),
                    quantity: Number(item.qty || 0),
                    item_price: Number(item.price || 0)
                }))
            },
            original_event_data: {
                event_name: 'Purchase',
                event_time: eventTime
            }
        }]
    };

    Object.keys(payload.data[0]).forEach((key) => {
        if (payload.data[0][key] === undefined) delete payload.data[0][key];
    });

    try {
        const response = await fetch(`https://graph.facebook.com/${apiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            await Order.updateOne({ _id: order._id }, { $set: { metaPixelPurchaseSent: false } });
            console.error('Meta Conversions API error:', { status: response.status, result });
            return { sent: false, error: true };
        }

        return { sent: true, result };
    } catch (error) {
        await Order.updateOne({ _id: order._id }, { $set: { metaPixelPurchaseSent: false } });
        console.error('Meta Conversions API request failed:', error.message);
        return { sent: false, error: true };
    }
}