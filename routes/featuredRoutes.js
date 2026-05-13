import express from "express";
import multer from "multer";
import path from 'path';
import Featured from '../models/featured.js';
import { verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// =============================
// ADMIN CODES
// =============================
// =============================
// MULTER CONFIG (🔥 MUST BE BEFORE ROUTES)
// =============================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/products');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images allowed'), false);
    }
};

const upload = multer({ storage, fileFilter });

// =============================
// CREATE FEATURE (MULTIPLE IMAGES)
// =============================
router.post('/', verifyAdmin, upload.array('images', 10), async (req, res) => {
    try {
        const { name, price, stock, size, description, gender, rating } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No Images uploaded' });
        }

        const imagePaths = req.files.map(file => file.filename);

        // ✅ FIX ALL ARRAY FIELDS
        const category = req.body.category ? JSON.parse(req.body.category) : [];
        const colors = req.body.colors ? JSON.parse(req.body.colors) : [];
        const sizes = req.body.sizes ? JSON.parse(req.body.sizes) : [];

        const newFeature = new Featured({
            name,
            category,
            price,
            stock,
            size,
            description,
            gender,
            rating,
            colors,
            sizes,
            images: imagePaths
        });

        const savedFeature = await newFeature.save();

        res.status(201).json(savedFeature);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==========================
// Get All Feature Products
// =========================
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const products = await Featured.find()
        .sort({ createdAt: -1 })
        .limit(6);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// ============================
// UPDATE PRODUCT
// ============================
router.put('/:id', verifyAdmin, upload.array('images', 10), async (req, res) => {
    try{
        const { name, category, price, stock, description } = req.body;

        const feature = await Featured.findByIdAndUpdate(req.params.id, {
            name,
            category,
            price,
            stock,
            description,
            images: req.files.map(file => file.filename)
        }, { new: true });

        if (!feature) {
            return res.status(404).json({ message: 'Feature not found' });
        }

        res.json(feature);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// DELETE PRODUCT
// ============================
router.delete('/:id', verifyAdmin, async (req, res) => {
    try { 
        const feature = await Featured.findByIdAndDelete(req.params.id);

        if (!feature) {
            return res.status(404).json({ message: 'Feature not found'});
        }

        res.json({ message: 'Feature deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// END OF ADMIN CODES
// ============================

// =============================
// FRONTEND CODES
// ============================
// ============================
// GET FEATUREs FOR THE FRONTEND
// ============================
router.get('/latest-features', async (req, res) => {
    try{
        const featured = await Featured.find({ stock: {$gt: 0} })
        .sort({ createdAt: -1 })
        .limit(6);
        res.json(featured);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SINGLE FEATURE
router.get('/:id', async (req, res) => {
    try {
        const feature = await Featured.findById(req.params.id);
        if (!feature) return res.status(404).json({ message: 'Not found' });
        res.json(feature);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router; 