import mongoose from 'mongoose';
import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Feature from '../models/featured.js';
import FlashSale from '../models/flashsale.js';
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


// ==============================
// SIGNUP
// ==============================
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({ success: false, message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        await newUser.save();

        res.json({ success: true, message: "User registered successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==============================
// LOGIN
// ==============================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid email or password" });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token,
            username: user.firstName
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// =============================
// COUNT THE NUMBER OF USERS (ADMIN)
// =============================
router.get('/admin/count', verifyAdmin, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.json({ success: true, userCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET CURRENT USER (Updated for Checkout)
router.get('/me', async (req, res) => {
    try {
        let token = req.headers.authorization;

        if (token && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "No token" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const cart = await Promise.all(
            user.cart.map(async (item) => {
                let data = item.itemType === "product"
                    ? await Product.findById(item.itemId)
                    : await Feature.findById(item.itemId);

                return { ...item.toObject(), itemData: data };
            })
        );

        user.cart = cart;

        res.json({ success: true, user });

    } catch (error) {
        console.error("Auth Error:", error);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
});


// UPDATE PROFILE
router.put('/update-profile', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { firstName, lastName, email, phone, gender } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            decoded.id,
            { firstName, lastName, email, phone, gender },
             { returnDocument: 'after' } 
        );

        res.json({ success: true, user: updatedUser });

    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// UPDATE PROFILE PICTURE
router.put('/upload-profile-image', upload.single('image'), async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const imagePath = `/uploads/products/${req.file.filename}`;

        const user = await User.findByIdAndUpdate(
            decoded.id,
            { image: imagePath },
            { returnDocument: 'after' }
        );

        res.json({ success: true, image: user.image });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// UPDATED ADDRESS
router.put('/update-address', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { address, state, postalCode, country, phone } = req.body;

        const user = await User.findByIdAndUpdate(
            decoded.id,
            { address, state, postalCode, country, phone },
            { returnDocument: 'after' }
        );

        res.json({ success: true, user });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

//Update Mpesa Number
router.put('/update-mpesa', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { MpesaNo } = req.body;

        const user = await User.findByIdAndUpdate(
            decoded.id,
            { MpesaNo },
            { returnDocument: 'after' }
        );

        res.json({ success: true, user });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});


// CHANGE PASSWORD
router.put('/change-password', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(decoded.id);

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Wrong password" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);

        // ✅ SAVE HISTORY
        user.passwordHistory.push({
            changedAt: new Date()
        });

        user.password = hashed;
        await user.save();

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// GET PASSWORD HISTORY
router.get('/password-history', async (req, res) => {
    try {
        const token = req.headers.authorization;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        res.json({
            success: true,
            history: user.passwordHistory.reverse()
        });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// =============================
// SYNC CART TO DATABASE
// =============================
router.post('/sync-cart', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        if (token.startsWith('Bearer ')) {
            token = token.split(' ')[1]; 
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { itemId, itemType, color, size, qty } = req.body;

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const existingItem = user.cart.find(item => 
            item.itemId.toString() === itemId &&
            item.itemType === itemType &&
            item.color === color && 
            item.size === size
        );

        if (existingItem) {
            existingItem.qty += qty;
        } else {
            user.cart.push({ itemId, itemType, color, size, qty });
        }

        await user.save();

        res.json({ success: true, message: "Cart synced successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// =============================
// SYNC WISHLIST TO DATABASE
// =============================
router.post('/sync-wishlist', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }

        if (token.startsWith('Bearer ')) {
            token = token.split(' ')[1]; 
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { itemId, itemType } = req.body;

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isAlreadyAdded = user.wishlist.some(item => 
            item.itemId.toString() === itemId &&
            item.itemType === itemType
        );

        if (!isAlreadyAdded) {
            user.wishlist.push({ itemId, itemType });
            await user.save();
        }

        res.json({ success: true, message: "Wishlist updated" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.get('/my-data', async (req, res) => {
    try {
        let token = req.headers.authorization;

        if (token && token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 🔥 MANUAL POPULATION LOGIC
        const cart = await Promise.all(
            user.cart.map(async (item) => {
                let data = null;

                if (item.itemType === "product") {
                    data = await Product.findById(item.itemId);
                } else if (item.itemType === "feature") {
                    data = await Feature.findById(item.itemId);
                } else if (item.itemType === "flash") {
                    data = await FlashSale.findById(item.itemId);
                }

                return {
                    ...item.toObject(),
                    itemData: data
                };
            })
        );

        const wishlist = await Promise.all(
            user.wishlist.map(async (item) => {
                let data = null;

                if (item.itemType === "product") {
                    data = await Product.findById(item.itemId);
                } else if (item.itemType === "feature") {
                    data = await Feature.findById(item.itemId);
                } else if (item.itemType === "flash") {
                    data = await FlashSale.findById(item.itemId);
                }

                return {
                    ...item.toObject(),
                    itemData: data
                };
            })
        );

        // 🔥 REMOVE INVALID ITEMS (important)
        const validCart = cart.filter(i => i.itemData !== null);
        const validWishlist = wishlist.filter(i => i.itemData !== null);

        // Optional cleanup
        user.cart = validCart.map(i => ({
            _id: i._id,
            itemId: i.itemId,
            itemType: i.itemType,
            color: i.color,
            size: i.size,
            qty: i.qty
        }));

        user.wishlist = validWishlist.map(i => ({
            _id: i._id,
            itemId: i.itemId,
            itemType: i.itemType
        }));

        await user.save();

        res.json({
            success: true,
            user: {
                ...user.toObject(),
            },
            cart: validCart,
            wishlist: validWishlist
        });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
});

// ============================================
// COUNT CART ITEMS
// ============================================
router.get('/cart-count', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (token?.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Authorization token missing or malformed" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const cartCount = user.cart.reduce((sum, item) => sum + item.qty, 0);
        console.log("Cart Count:", cartCount);

        res.json({ success: true, cartCount });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
});


// ============================================
// UPDATE CART ITEM QUANTITY FROM CART PAGE
// ============================================
router.put('/cart/update-quantity', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (token?.startsWith('Bearer ')) token = token.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const { itemId, qty } = req.body;

        const user = await User.findOneAndUpdate(
            { _id: decoded.id, "cart._id": itemId },
            { $set: { "cart.$.qty": Number(qty) } },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({ success: true, message: "Item not found" });
        }

        // We return success, and the frontend's fetchCart() will handle the complex population
        res.json({ success: true });
    } catch (error) {
        console.error("Update Cart Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// REMOVE ITEM FROM CART
// ============================================
router.delete('/cart/remove/:itemId', async (req, res) => {
    try {
        let token = req.headers.authorization;
        if (token?.startsWith('Bearer ')) token = token.split(' ')[1];
        
        if (!token) return res.status(401).json({ success: false, message: "No token provided" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { itemId } = req.params;

        // $pull removes the sub-document that matches the criteria
        const user = await User.findByIdAndUpdate(
            decoded.id,
            { $pull: { cart: { _id: itemId } } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "Item removed from cart" });
    } catch (error) {
        console.error("Delete Item Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// ============================================
// REMOVE ITEM FROM WISHLIST
// ============================================
router.delete('/wishlist/remove/:itemId', async (req, res) => {
    try {
        let token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ success: false, message: "No token" });
        }

        if (token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(decoded.id, {
            $pull: { wishlist: { _id: req.params.itemId } }
        });

        res.json({ success: true, message: "Removed from wishlist" });

    } catch (error) {
        console.error("Remove Wishlist Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// CLEAR CART
// ============================================
// Route to clear the entire cart
router.delete('/cart/clear', async (req, res) => {
    try {
        let token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ success: false, message: "No token" });
        }

        if (token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(
            decoded.id,
            { $set: { cart: [] } }
        );

        res.json({ success: true, message: "Cart cleared successfully" });

    } catch (error) {
        console.error("Clear Cart Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ============================================
// CLEAR WISHLIST
// ============================================
// Route to clear the entire wishlist
router.delete('/wishlist/clear', async (req, res) => {
    try {
        let token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ success: false, message: "No token" });
        }

        if (token.startsWith('Bearer ')) {
            token = token.split(' ')[1];
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        await User.findByIdAndUpdate(
            decoded.id,
            { $set: { wishlist: [] } }
        );

        res.json({ success: true, message: "Wishlist cleared successfully" });

    } catch (error) {
        console.error("Clear Wishlist Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;