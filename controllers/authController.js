//authController
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export const adminLogin = async (req, res) => {
    const { username, password, adminType } = req.body;

    let validUsername, validPassword;

    if (adminType === 'men') {
        validUsername = ENV.ADMIN_MEN_USERNAME.trim();
        validPassword = ENV.ADMIN_MEN_PASSWORD.trim();
    } else if (adminType === 'women') {
        validUsername = ENV.ADMIN_WOMEN_USERNAME.trim();
        validPassword = ENV.ADMIN_WOMEN_PASSWORD.trim();
    } else {
        return res.status(400).json({ success: false, message: 'Invalid admin type' });
    }

    if (username.trim() !== validUsername) {
        return res.status(401).json({ success: false, message: 'Invalid username' });
    }

    if (password.trim() !== validPassword) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    
    if (!ENV.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: 'JWT secret is not set in environment'
        });
    }

    const token = jwt.sign(
        { username: validUsername, adminType, role: 'admin' },
        ENV.JWT_SECRET,
        { expiresIn: '1d' }
    );
    

    res.json({ success: true, token });
};
