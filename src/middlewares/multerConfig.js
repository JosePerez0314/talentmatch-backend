import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import cloudinary from './cloudinaryConfig.js'

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        allowed_formats: ['pdf'],
    },
});

const upload = multer({ storage: storage });

export default upload;