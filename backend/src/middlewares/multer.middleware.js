import multer from "multer";

// Use memoryStorage so file buffer is available as req.file.buffer
// This lets us pipe files directly to S3 without writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "application/pdf",                                                                    // PDF
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
        "application/msword",                                                                 // DOC
        "image/jpeg",                                                                         // JPG
        "image/png",                                                                          // PNG
        "image/webp",                                                                         // WEBP
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only PDF, DOCX, JPG, PNG, and WEBP files are allowed."), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // Max 10MB per file
    },
});

