import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    image: { type: String }, 
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    MpesaNo: { type: String },
    address: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    password: { type: String, required: true },
    passwordHistory: [
        {
            changedAt: { type: Date, default: Date.now }
        }
    ],
    gender: { type: String, enum: ['Male', 'Female'], default: 'Male' },

    // 🔥 NEW: Cart System (Synchronized)
    cart: [{
        itemId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true,
            refPath: 'cart.itemType' // 🔥 This tells Mongoose to look at itemType to decide which collection to use
        },
        itemType: { 
            type: String, 
            enum: ['product', 'feature', 'flash'], 
            required: true 
        },
        color: { type: String },
        size: { type: String },
        qty: { type: Number, default: 1, min: 1 }
    }],

    // 🔥 NEW: Wishlist System (Synchronized)
    wishlist: [{
        itemId: { 
            type: mongoose.Schema.Types.ObjectId, 
            required: true 
            
        },
        itemType: { 
            type: String, 
            enum: ['product', 'feature', 'flash'], 
            required: true 
        },
        // color: { type: String },
        // size: { type: String },
        // qty: { type: Number, default: 1, min: 1 }
        addedAt: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;