import crypto from "node:crypto";

/**
 * Validates actual binary signatures (magic bytes) of uploaded files
 * Ensures users cannot disguise malicious executables as .pdf or .png
 * @param {Buffer} buffer - File memory buffer
 * @returns {"pdf" | "docx" | "image" | null}
 */
export const detectFileTypeFromMagicBytes = (buffer) => {
    if (!buffer || buffer.length < 4) return null;

    // PDF: %PDF (hex: 25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return "pdf";
    }

    // JPEG: (hex: FF D8 FF)
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image";
    }

    // PNG: (hex: 89 50 4E 47)
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return "image";
    }

    // DOCX / Office Open XML (ZIP format): PK.. (hex: 50 4B 03 04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
        return "docx";
    }

    return null;
};

/**
 * Computes SHA-256 hash of a file buffer for deduplication
 * @param {Buffer} buffer
 * @returns {string} Hex hash string
 */
export const computeFileSha256 = (buffer) => {
    return crypto.createHash("sha256").update(buffer).digest("hex");
};

