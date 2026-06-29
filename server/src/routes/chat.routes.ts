import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { ChatService } from '../services/chat.service';
import { CitationService } from '../services/citation.service';

const router = Router();

// Apply requireAuth to all chat routes
router.use(requireAuth);

// POST /api/v1/chat/ask
router.post('/ask', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { query, conversationId, documentId, mode, rerank } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Parameters "query" is required' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const response = await ChatService.askQuestion({
      userId: req.user.id,
      query,
      conversationId,
      documentId,
      mode,
      rerank,
    });

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/chat/history
router.get('/history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const history = await ChatService.getConversationsHistory(req.user.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/citations/:answerId
router.get('/citations/:answerId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const citationsList = await CitationService.getCitationsForMessage(req.params.answerId);
    res.json(citationsList);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/chat/analytics
router.get('/analytics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const analytics = await ChatService.getRagAnalytics(req.user.id);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

export default router;
