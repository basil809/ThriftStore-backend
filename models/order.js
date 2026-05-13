// Order Model FOR THRIFT STORE
import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, unique: true, required: true }, // e.g., RR-1025-AX
    transactionId: { type: String, unique: true, required: true }, // e.g., TRX-998234
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        qty: Number,
        size: String,
        color: String,
        image: String
    }],
    billingDetails: {
        firstName: String,
        lastName: String,
        phone: String,
        email: String,
        address: String,
        city: String,
        state: String,
        country: String
    },
    subtotal: Number,
    shippingFee: Number,
    totalAmount: Number,
    status: { type: String, default: 'Pending', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
    paymentStatus: { type: String, default: 'Unpaid' }, 
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

export default Order;

