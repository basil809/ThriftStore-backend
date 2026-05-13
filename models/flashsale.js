import e from 'express';
import mongoose from 'mongoose';

const FlashSaleSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true }, // Added this
    category: {
        type: String,
        required: true
    },
    productType: {
        type: String,
    },
     // 🔥 New: Array of strings to store multiple colors
    colors: {
        type: [String],
        default: []
    },
    // 🔥 New: Array of strings to store multiple sizes (e.g., ["UK 7", "UK 8"] or ["S", "M"])
    sizes: {
        type: [String],
        default: []
    },
    // 🔥 New: Added gender field
    gender: {
        type: String,
        enum: ['men', 'women', 'unisex', ''], // Matches your HTML options
        default: 'unisex'
    }, 
    stock: {
        type: Number,
        required: true
    },
    // 🔥 New: Added rating field
    rating: {
        type: String,
        default: '5 Star'
    },
     reviews: { 
        type: Number, 
        default: 0 
    },// 🔥 New: Auto-calculated reviews
    status: {
        type: String,
        enum: ['active', 'inactive', 'out of stock'],
        default: 'active'
    },
     sku: { 
        type: String, 
        unique: true 
    }, // 🔥 New: Unique Stock Keeping Unit
    oldPrice: { type: Number, required: true },
    description: { type: String },
    newPrice: { type: Number, required: true },
    discountPercentage: { type: Number, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, expires: 0, required: true },
    images: { type: [String], required: true }, // Added this to store the filename
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 🔥 AUTO-GENERATE SKU BEFORE SAVING
FlashSaleSchema.pre('save', function(next) {
    // 1. Logic for automatic SKU (e.g., FLS-12344)
    if (!this.sku) {
        const catPrefix = ('FLS').substring(0, 3).toUpperCase();
        const randomNum = Math.floor(10000 + Math.random() * 90000); // 
        this.sku = `${catPrefix}-${randomNum}`;
    }

    //next();
});

const FlashSale = mongoose.model('FlashSale', FlashSaleSchema); 
export default FlashSale;
