import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { s3, BUCKET } from '../services/s3';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'text/plain',
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multerS3({
  s3,
  bucket: BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (_req, file, cb) => cb(null, { originalName: file.originalname }),
  key: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `documents/${uuid()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});
