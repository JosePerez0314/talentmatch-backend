import multer from 'multer'

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    //Limit file size to 5MB
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed!"), false)
        }
    }
});

export default upload;