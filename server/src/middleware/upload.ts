import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE } from '@docmind/shared';

// Load config
const uploadDirOriginals = process.env.UPLOAD_DIR_ORIGINALS || 'uploads/originals';

// Ensure the directory exists
if (!fs.existsSync(uploadDirOriginals)) {
  fs.mkdirSync(uploadDirOriginals, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirOriginals);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using random UUID + original extension
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = Object.values(SUPPORTED_MIME_TYPES) as string[];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only PDF, DOCX, and PPTX are allowed. Got MIME type: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 50MB
  },
});
