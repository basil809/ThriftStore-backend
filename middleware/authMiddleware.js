import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const secret = process.env.JWT_SECRET || ENV.JWT_SECRET;
        if (!secret) {
            console.error('Auth error: JWT secret not set');
            return res.status(500).json({ message: 'Server misconfiguration: JWT secret missing' });
        }

        const decoded = jwt.verify(token, secret);

        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Not an admin.' });
        }

        req.user = decoded;
        next();

    } catch (error) {
        // Avoid printing the full token; show whether a token was present and basic error
        console.error('Auth error:', error.message, 'tokenPresent=', !!token);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};