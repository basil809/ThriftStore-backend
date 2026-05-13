// categoryRoutes.js
import express from 'express';
import Category from '../models/Category.js';
import { verifyAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();


// ✅ CREATE CATEGORY
router.post('/', verifyAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;

        const category = new Category({ name, description });
        await category.save();

        res.json(category);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ✅ GET ALL CATEGORIES
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ UPDATE CATEGORY
router.put('/:id', verifyAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true }
        );
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ✅ DELETE CATEGORY  
router.delete('/:id', verifyAdmin, async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;