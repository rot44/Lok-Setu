import multer from "multer";

// Use memoryStorage so file buffer is available as req.file.buffer
// This lets us pipe files directly to S3 without writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        "application/pdf",                                                         // PDF
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
        "application/msword",                                                      // DOC
        "image/jpeg",                                                              // JPG
        "image/png",                                                               // PNG
        "image/webp",                                                              // WEBP
        "text/plain",                                                              // TXT
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only PDF, DOCX, JPG, PNG, WEBP, and TXT files are allowed."), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // Max 10MB per file
    },
});

const audioFileFilter = (req, file, cb) => {
    if (
        file.mimetype.startsWith("audio/") ||
        file.mimetype === "application/octet-stream" ||
        file.mimetype === "video/webm"
    ) {
        cb(null, true);
    } else {
        cb(new Error("Invalid audio file format. Please upload an audio recording."), false);
    }
};

export const audioUpload = multer({
    storage,
    fileFilter: audioFileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024, // Max 15MB per audio file
    },
});
