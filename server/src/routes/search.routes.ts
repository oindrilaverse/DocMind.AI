import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { SearchService } from '../services/search.service';

const router = Router();

// Apply requireAuth to all search routes
router.use(requireAuth);

// GET /api/v1/search
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string;
    const documentId = req.query.documentId as string | undefined;
    const limitVal = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const mode = req.query.mode as 'semantic' | 'keyword' | 'hybrid' | undefined;
    const rerank = req.query.rerank === 'true' ? true : req.query.rerank === 'false' ? false : undefined;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query parameter "q" is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const results = await SearchService.search({
      userId: req.user.id,
      query,
      documentId,
      limit: limitVal,
      mode,
      rerank,
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/search/query
router.post('/query', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query, documentId, limit, mode, rerank } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search body parameter "query" is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const results = await SearchService.search({
      userId: req.user.id,
      query,
      documentId,
      limit,
      mode,
      rerank,
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/search/stats
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const stats = await SearchService.getSearchStats(req.user.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
