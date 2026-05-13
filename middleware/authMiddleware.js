import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token' });
    }

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // OPTIONAL: check if admin
        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }

        req.user = decoded;
        next();

    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};