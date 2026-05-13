import { v2 as cloudinary } from 'cloudinary';

// Auto configure with .env file CLOUDINARY_URL="cloudinary://<your_api_key>:<your_api_secret>@<your_cloud_name>"
cloudinary.config(true);

export default cloudinary;