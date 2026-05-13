import mongoose from "mongoose";

const featuredSchema = new mongoose.Schema({
     name: {
        type: String,
        required: true
    },
    category: {
       type: [String], 
        required: true
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
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    sku: { 
        type: String, 
        unique: true 
    },
    reviews: { 
        type: Number, 
        default: 0 
    }, // 🔥 New: Auto-calculated reviews
    rating: {
        type: String,
        default: '5 Star'
    },
    images: {
        type: [String], // 🔥 multiple images
        default: []
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'out of stock'],
        default: 'active'
    }
}, { timestamps: true });

// 🔥 AUTO-GENERATE SKU & REVIEWS BEFORE SAVING
featuredSchema.pre('save', function(next) {
    // 1. Logic for Automatic Reviews based on Rating
    const reviewMap = {
        '2 Star': 120,
        '3 Star': 180,
        '4 Star': 240,
        '5 Star': 300
    };
    this.reviews = reviewMap[this.rating] || 0;

    // 2. Logic for Automatic SKU (e.g., TS-SHIRT-12345)
    if (!this.sku) {
        const categoryStr = Array.isArray(this.category) ? this.category[0] : this.category;
        const catPrefix = ('FEA').substring(0, 3).toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random
        this.sku = `${catPrefix}-${randomNum}`;
    }

    //next();
});


const Featured = mongoose.model('Feature', featuredSchema);

export default Featured;