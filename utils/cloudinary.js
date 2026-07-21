import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = async (fileBuffer, folder = 'retro-rack') => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary credentials are not configured');
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(result.secure_url);
            }
        );

        uploadStream.end(fileBuffer);
    });
};

export const uploadMultipleToCloudinary = async (files, folder = 'retro-rack') => {
    if (!files || files.length === 0) {
        return [];
    }

    return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
};
