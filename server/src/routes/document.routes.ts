import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { DocumentService } from '../services/document.service';

const router = Router();

// Apply requireAuth to all document routes
router.use(requireAuth);

// Upload document
router.post(
  '/upload',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const doc = await DocumentService.createDocument({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  }
);

// Get all documents of the user
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const docs = await DocumentService.getDocumentsByUser(req.user.id);
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

// Get single document by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const doc = await DocumentService.getDocumentById(req.params.id, req.user.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found or unauthorized' });
    }

    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// Get single document chunk details
router.get('/chunks/:chunkId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const chunk = await DocumentService.getChunkById(req.params.chunkId, req.user.id);
    if (!chunk) {
      return res.status(404).json({ message: 'Chunk not found or unauthorized' });
    }

    res.json(chunk);
  } catch (error) {
    next(error);
  }
});

// Get document extracted plain text
router.get('/:id/text', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const text = await DocumentService.getDocumentText(req.params.id, req.user.id);
    res.json({ text });
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('unauthorized')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('not available')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// Delete document
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const success = await DocumentService.deleteDocument(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({ message: 'Document not found or unauthorized' });
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
