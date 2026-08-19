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
    ADMIN_WOMEN_PASSWORD: process.env.ADMIN_WOMEN_PASSWORD,

    // Meta Conversions API
    META_PIXEL_ID: process.env.META_PIXEL_ID,
    META_CONVERSIONS_API_TOKEN: process.env.META_CONVERSIONS_API_TOKEN,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v23.0'
};