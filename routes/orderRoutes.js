import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Order from '../models/order.js'; // Changed 'Orders' to 'Order' for consistency
import Product from '../models/Product.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();


// =============================
// CREATE ORDER
// =============================
router.post('/create', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ success: false, message: "No token provided" });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { billingDetails, items, subtotal, shippingFee, totalAmount } = req.body;

        const orderId = `RR-${Math.floor(1000 + Math.random() * 9000)}`;
        const transactionId = `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        const newOrder = new Order({ // Fixed: Now matches import
            user: decoded.id,
            orderId,
            transactionId,
            items,
            billingDetails,
            subtotal,
            shippingFee,
            totalAmount
        });

        await newOrder.save();
        await User.findByIdAndUpdate(decoded.id, { $set: { cart: [] } });

        res.status(201).json({ success: true, message: "Order placed successfully", order: newOrder });
    } catch (error) {
        console.error("Order Error:", error);
        res.status(500).json({ success: false, message: "Failed to place order" });
    }
});

// =============================================
// GET ALL ORDERS FOR LOGGED-IN USER
// =============================================
router.get('/user-orders', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (token && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        if (!token) return res.status(401).json({ success: false, message: "No token" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const orders = await Order.find({ user: decoded.id }).sort({ createdAt: -1 }); // Fixed: Now matches import

        res.json({ success: true, orders });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Add this to your backend routes
router.get('/:id', async (req, res) => {
    try {
        // We use findById because we passed the MongoDB _id from the frontend
        const order = await Order.findById(req.params.id); 

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found in database" 
            });
        }

        res.json({ 
            success: true, 
            order: order 
        });
    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while retrieving order" 
        });
    }
});

// GET ALL ORDERS (Admin Access)
router.get('/admin/all', verifyAdmin, async (req, res) => {
    try {
        // .sort({ createdAt: -1 }) ensures newest orders are first
        const orders = await Order.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Admin Orders Fetch Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// GET THE TOTAL NUMBER OF ORDERS, Delivered Orders, Pending Orders (Admin Access)
router.get('/admin/total-orders', verifyAdmin, async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const deliveredOrders = await Order.countDocuments({ status: "Delivered" });
        const pendingOrders = await Order.countDocuments({ status: "Pending" });

        res.json({
            success: true,
            totalOrders,
            deliveredOrders,
            pendingOrders
        });
    }
    catch (error) {
        console.error("Error fetching total orders:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// GET ANALYTICS (Admin)
router.get('/admin/analytics', verifyAdmin, async (req, res) => {
    try {
        // 1. Monthly stats (current month) — exclude cancelled
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyAgg = await Order.aggregate([
            { $match: { status: { $ne: "Cancelled" }, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, monthlyRevenue: { $sum: "$totalAmount" }, avgOrderValue: { $avg: "$totalAmount" }, totalOrders: { $sum: 1 } } }
        ]);

        // 2. NEW: Daily Sales Data for the Chart (Last 7 Days)
        const salesData = await Order.aggregate([
            { $match: { status: { $ne: "Cancelled" } } },
            {
                $group: {
                    // Group by year, month, and day
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    dailyTotal: { $sum: "$totalAmount" }
                }
            },
            { $sort: { "_id": 1 } }, // Sort by date ascending
            { $limit: 7 } // Get last 7 days
        ]);

        const totalCustomers = await Order.distinct("billingDetails.email");
        const result = monthlyAgg[0] || { monthlyRevenue: 0, avgOrderValue: 0, totalOrders: 0 };

        // Inventory total (sum of price * stock across all products)
        const inventoryAgg = await Product.aggregate([
            { $group: { _id: null, inventoryValue: { $sum: { $multiply: ["$price", "$stock"] } } } }
        ]);
        const inventoryValue = (inventoryAgg[0] && inventoryAgg[0].inventoryValue) ? inventoryAgg[0].inventoryValue : 0;

        // Total amount of all pending orders (Ksh.)
        const pendingTotalAgg = await Order.aggregate([
            { $match: { status: "Pending" } },
            { $group: { _id: null, pendingTotal: { $sum: "$totalAmount" } } }
        ]);
        const ordersTotalKsh = (pendingTotalAgg[0] && pendingTotalAgg[0].pendingTotal) ? pendingTotalAgg[0].pendingTotal : 0;

        res.json({
            success: true,
            analytics: {
                monthlyRevenue: result.monthlyRevenue || 0,
                totalCustomers: totalCustomers.length,
                avgOrderValue: Math.round(result.avgOrderValue) || 0,
                conversionRate: "3.2",
                chartData: salesData, // This will be [{_id: '2026-04-04', dailyTotal: 3749.99}, ...]
                // Overall totals
                // `totalRevenueAllTime` = inventory value (sum price * stock)
                totalRevenueAllTime: inventoryValue || 0,
                // `totalOrdersKsh` = total amount from all non-cancelled orders
                totalOrdersKsh: ordersTotalKsh || 0
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPDATE ORDER STATUS (Admin Access)
router.put('/update-status/:id', verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        
        // Find by ID and update the status field
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true } // returns the updated document
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, message: "Status updated successfully", order: updatedOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;