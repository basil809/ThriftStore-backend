import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer'; // Import multer to handle MulterError
import open from 'open';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import UserRoutes from './routes/UserRoutes.js';
import productsRoutes from './routes/productsRoutes.js';
import flashsaleRoutes from './routes/flashsaleRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import featuredRoutes from './routes/featuredRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
// Fix for __dirname in ES Modules 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Define the path to your images folder (one level up in thrift-store)
const imagesPath = path.join(__dirname, '..', 'public', 'images');

// Serve the images folder at the '/images' route
app.use('/images', express.static(imagesPath));

// 1. Serve your frontend 
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', UserRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/flash-sales', flashsaleRoutes);
app.use('/api/featured', featuredRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/newsletters', newsletterRoutes);

// Test
app.get('/', (req, res) => {
    //Locate the index.html file in the public directory found in thrift-store and send it as the response 
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global Error Handling Middleware
// This middleware will catch any errors that occur in the application,
// including those from Multer, and send a proper JSON response.
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging purposes
    const statusCode = err.statusCode || 500;
    let message = err.message || 'Something went wrong!';

    if (err instanceof multer.MulterError) {
        message = `File upload error: ${err.message}`;
        return res.status(400).json({ message });
    }
    res.status(statusCode).json({ message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});