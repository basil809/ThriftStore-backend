// Newsletter subscription model
import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true, 
        trim: true,
        lowercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;