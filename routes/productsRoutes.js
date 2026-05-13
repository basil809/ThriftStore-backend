import express from 'express';
import multer from 'multer';
import path from 'path';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// =============================
// MULTER CONFIG
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
// CREATE PRODUCT
// =============================
router.post('/', verifyAdmin, upload.array('images', 10), async (req, res) => {
    try {
        const { name, category, price, stock, description, gender, rating, productType } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No images uploaded' });
        }

        const imagePaths = req.files.map(file => file.filename);

        // 🔥 IMPORTANT: Parse the JSON strings back into Arrays
        const colors = req.body.colors ? JSON.parse(req.body.colors) : [];
        const sizes = req.body.sizes ? JSON.parse(req.body.sizes) : [];

        const newProduct = new Product({
            name,
            category,
            price,
            stock,
            productType,
            description,
            gender,
            rating,
            colors, // Saved as array
            sizes,  // Saved as array
            images: imagePaths
        });

        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// ============================
// UPDATE PRODUCT
// ============================
router.put('/:id', verifyAdmin, upload.array('images', 10), async (req, res) => {
    try {
        const { name, category, price, stock, description, gender, rating } = req.body;
        
        // Prepare the update object
        const updateData = {
            name,
            category,
            price,
            stock,
            description,
            gender,
            rating
        };

        // 🔥 Parse colors and sizes if they exist in the request
        if (req.body.colors) updateData.colors = JSON.parse(req.body.colors);
        if (req.body.sizes) updateData.sizes = JSON.parse(req.body.sizes);

        // Only update images if new ones were uploaded
        if (req.files && req.files.length > 0) {
            updateData.images = req.files.map(file => file.filename);
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id, 
            updateData, 
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// =============================
// GET ALL PRODUCTS (ADMIN)
// =============================
router.get('/', verifyAdmin, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// DELETE PRODUCT
// ============================
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// FRONTEND ROUTES
// ============================

router.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/latest-products', async (req, res) => {
    try {
        const products = await Product.find({ stock: { $gt: 0 } })
        .sort({ createdAt: -1 })
        .limit(6);
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// BESTSELLING
// =============================
// THIS WILLL BASED ON THE PRODUCTS MARKED DELIVERED IN THE ORDER MODEL
// I will use the _id in the order collection to locate the product/item in the product collection
// send the product to frontend
router.get('/bestselling', async (req, res) => {
    try {
        // 1. Aggregate orders to find most sold products
        const bestSellers = await Order.aggregate([
            // Only look at successful deliveries
            { $match: { status: 'Delivered' } },

            // Break down the items array in each order
            { $unwind: '$items' },

            // Group by the product ID and sum the quantity
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.qty' }
            }
        },

        // Sort by tatolSold in descending order (highest first)
        { $sort: { totalSold: -1 } },

        // Limit to top 10 best sellers
        { $limit: 10 }
    ]);

    if (!bestSellers || bestSellers.length === 0) {
            return res.status(200).json({ success: true, products: [] });
        }

        // 2. Map the IDs to fetch the actual Product details
        const productIds = bestSellers.map(item => item._id);
        
        // Fetch products that match these IDs
        const products = await Product.find({ _id: { $in: productIds } });

        // 3. (Optional) Re-sort the products to match the 'bestSellers' rank 
        // because Product.find doesn't guarantee order.
        const sortedProducts = productIds.map(id => 
            products.find(p => p._id.toString() === id.toString())
        ).filter(p => p !== undefined); // Remove nulls if a product was deleted

        res.status(200).json({
            success: true,
            count: sortedProducts.length,
            products: sortedProducts
        });

    } catch (error) {
        console.error('Error fetching bestsellers:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

router.get('/:id', async (req, res) => {
    try{
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product Not Found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================
// BESTSELLING
// =============================
// THIS WILLL BASED ON THE PRODUCTS MARKED DELIVERED IN THE ORDER MODEL
// I will use the _id in the order collection to locate the product/item in the product collection
// send the product to frontend
router.get('/bestselling', async (req, res) => {
    try {
        // 1. Aggregate orders to find most sold products
        const bestSellers = await Order.aggregate([
            // Only look at successful deliveries
            { $match: { status: 'Delivered' } },

            // Break down the items array in each order
            { $unwind: '$items' },

            // Group by the product ID and sum the quantity
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.qty' }
            }
        },

        // Sort by tatolSold in descending order (highest first)
        { $sort: { totalSold: -1 } },

        // Limit to top 10 best sellers
        { $limit: 10 }
    ]);

    if (!bestSellers || bestSellers.length === 0) {
            return res.status(200).json({ success: true, products: [] });
        }

        // 2. Map the IDs to fetch the actual Product details
        const productIds = bestSellers.map(item => item._id);
        
        // Fetch products that match these IDs
        const products = await Product.find({ _id: { $in: productIds } });

        // 3. (Optional) Re-sort the products to match the 'bestSellers' rank 
        // because Product.find doesn't guarantee order.
        const sortedProducts = productIds.map(id => 
            products.find(p => p._id.toString() === id.toString())
        ).filter(p => p !== undefined); // Remove nulls if a product was deleted

        res.status(200).json({
            success: true,
            count: sortedProducts.length,
            products: sortedProducts
        });

    } catch (error) {
        console.error('Error fetching bestsellers:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});


export default router;