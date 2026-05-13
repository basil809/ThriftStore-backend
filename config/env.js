import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
    JWT_ISSUER: process.env.JWT_ISSUER || 'thrift-store',

    // Admin Credentials
    ADMIN_MEN_USERNAME: process.env.ADMIN_MEN_USERNAME,
    ADMIN_MEN_PASSWORD: process.env.ADMIN_MEN_PASSWORD,

    ADMIN_WOMEN_USERNAME: process.env.ADMIN_WOMEN_USERNAME,
    ADMIN_WOMEN_PASSWORD: process.env.ADMIN_WOMEN_PASSWORD
};