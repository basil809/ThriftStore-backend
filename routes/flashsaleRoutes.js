import express from 'express';
import multer from 'multer';    
import Product from '../models/Product.js'; 
import FlashSale from '../models/flashsale.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';
import mongoose from 'mongoose';

const router = express.Router();

// =============================
// ADMIN CODES  
// =============================
// =============================
// MULTER CONFIG (🔥 MUST BE BEFORE ROUTES )
// =============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/flashsales');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('Only images allowed'), false);
    }
};

const upload = multer({ storage, fileFilter });

// ==============================================
// CREATE FLASH SALE
// ==============================================
router.post('/create', verifyAdmin, async (req, res) => {
    try {
        const { productId, newPrice, startTime, endTime } = req.body;

        // ✅ Validate required fields
        if (!productId || !newPrice || !startTime || !endTime) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // ✅ Fetch product from DB
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const oldPrice = product.price;

        // ✅ Price validation
        if (newPrice >= oldPrice || oldPrice <= 0) {
            return res.status(400).json({ message: 'Invalid pricing for flash sale' });
        }

        // ✅ Time validation
        if (new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({ message: 'End time must be after start time' });
        }

        // ✅ Calculate discount
        const discountPercentage = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

        // ✅ CREATE FLASH SALE (NOW INCLUDING ALL REQUIRED FIELDS)
        const flashSale = new FlashSale({
            product: product._id,
            productName: product.name,
            category: product.category,
            productType: product.productType,
            colors: product.colors || [],
            sizes: product.sizes || [],
            gender: product.gender || 'unisex',
            stock: product.stock,
            rating: product.rating || '5 Star',
            reviews: product.reviews || 0,
            status: product.status || 'active',
            descripion: product.description || 'No Description Available',
            oldPrice,
            newPrice,
            discountPercentage,
            startTime,
            endTime,
            // Allow multiple images
            images: product.images || [] // Use product images for flash sale
        });

        const savedFlashSale = await flashSale.save();

        res.status(201).json({
            success: true,
            data: savedFlashSale
        });

    } catch (error) {
        console.error('Error creating flash sale:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==============================================
// GET ALL FLASH SALES (FOR ADMIN DASHBOARD)
// ==============================================
router.get('/all', verifyAdmin, async (req, res) => {
    try {
        const flashSales = await FlashSale.find().sort({ createdAt: -1 });

        // send back the flash sales with the image URL
        res.status(200).json({
            success: true,
            count: flashSales.length,
            flashSales
        });
    } catch (error) {
        console.error('Error fetching flash sales:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ==============================================
// GET TOTAL NUMBER OF FLASH SALES (ADMIN DASHBOARD)
// ==============================================
router.get('/admin/flash-sale-count', verifyAdmin, async (req, res) => {
    try {
        const flashSaleCount = await FlashSale.countDocuments();
        res.json({ success: true, flashSaleCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// ==============================================
// GET DEAL OF THE WEEK (HOMEPAGE FEATURE)
// ==============================================
router.get('/deal-of-the-week', async (req, res) => {
    try {
        const now = new Date();
        const dealOfTheWeek = await FlashSale.findOne({
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).sort({ discountPercentage: -1 }).populate('product');

        if (!dealOfTheWeek) {
            return res.status(404).json({ message: 'No deal of the week found' });
        }

        res.json({ success: true, deal: dealOfTheWeek });
    } catch (error) {
        console.error('Error fetching deal of the week:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==============================================
// DELETE FLASH SALE
// ==============================================
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const flashSale = await FlashSale.findByIdAndDelete(req.params.id);  
        if (!flashSale) {
            return res.status(404).json({ message: 'Flash sale not found' });
        }
        res.json({ message: 'Flash sale deleted successfully' });
    } catch (error) {
        console.error('Error deleting flash sale:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ==============================
// FRONTEND ROUTES
// ==============================
// FETCH ALL ACTIVE FLASH SALES
router.get('/active', async (req, res) => {
    try {
        const now = new Date();
        const activeFlashSales = await FlashSale.find({
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).sort({ discountPercentage: -1 }); // Show biggest discounts first
        res.json({ success: true, flashSales: activeFlashSales });
    } catch (error) {
        console.error('Error fetching active flash sales:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// FETCH LATEST FLASH SALE (FOR HOMEPAGE)
router.get('/latest', async (req, res) => {
    try {
        const now = new Date();
        const latestFlashSale = await FlashSale.find({
            startTime: { $lte: now },
        })
        .sort({ createdAt: -1 })
        .limit(6);
        res.json(latestFlashSale);
    } catch (error) {
        console.error('Error fetching latest flash sale:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// FETCH FLASH SALE BY ID (FOR PRODUCT PAGE)
router.get('/:id', async (req, res) => {
    try {
        const flash = await FlashSale.findById(req.params.id).populate('product');
        if (!flash) {
            return res.status(404).json({ message: 'Flash sale not found' });
        }
        res.json({ success: true, flash });
    } catch (error) {
        console.error('Error fetching flash sale:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;