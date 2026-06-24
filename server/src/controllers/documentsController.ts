import { Request, Response, NextFunction } from 'express';
import { DocumentCategory } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { paginate, paginationMeta } from '../utils/paginate';
import { getPresignedDownloadUrl, deleteS3Object } from '../services/s3';

const uploadedBySelect = { id: true, firstName: true, lastName: true } as const;

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const categoryFilter = req.query.category as DocumentCategory | undefined;
    const where = categoryFilter && Object.values(DocumentCategory).includes(categoryFilter)
      ? { category: categoryFilter }
      : undefined;
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: uploadedBySelect } },
        skip,
        take,
      }),
      prisma.document.count({ where }),
    ]);
    res.json({ documents, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return next(new AppError(400, 'No file uploaded'));

    const category = (req.body.category as DocumentCategory) ?? 'GENERAL';
    if (!Object.values(DocumentCategory).includes(category)) {
      return next(new AppError(400, 'Invalid category'));
    }

    const name = (req.body.name as string)?.trim() || req.file.originalname;
    // multer-s3 stores the S3 key in req.file.key
    const s3File = req.file as Express.MulterS3.File;

    const document = await prisma.document.create({
      data: {
        name,
        filename: s3File.key,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        category,
        uploadedById: req.userId!,
      },
      include: { uploadedBy: { select: uploadedBySelect } },
    });

    res.status(201).json({ document });
  } catch (err) {
    next(err);
  }
}

export async function downloadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return next(new AppError(404, 'Document not found'));

    const url = await getPresignedDownloadUrl(doc.filename, doc.name);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) return next(new AppError(404, 'Document not found'));

    await deleteS3Object(doc.filename);
    await prisma.document.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
