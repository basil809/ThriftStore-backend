//Models/Newsletter.js
import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message body is required'],
        trim: true
    },
    imageUrl: {
        type: String, // Stores the URL or file path of the uploaded image
        default: null
    },
    sentBy: {
        type: String,
        required: true,
        default: 'Admin' // Default to 'Admin' if you want to keep it simple
    }
}, { timestamps: true });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter;