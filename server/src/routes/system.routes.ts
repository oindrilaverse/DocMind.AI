import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { OllamaEmbeddingProvider } from '../services/ollama.embedding';

const router = Router();

// Apply requireAuth to system routes
router.use(requireAuth);

// GET /api/v1/system/ollama-status
router.get('/ollama-status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const provider = new OllamaEmbeddingProvider();
    const online = await provider.checkHealth();
    
    res.json({
      online,
      model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
