import multer from 'multer'

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    //Limit file size to 5MB
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => { // cb parament is for specify if an error exits and accept the file by a boolean value
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed!"), false)
        }
    }
});

export default upload;