/**
 * evaluation.routes.ts — Phase 4: AI Evaluation Dashboard API
 *
 * PURPOSE:
 *   Exposes the evaluation data collected by EvaluationService as REST endpoints.
 *   All routes are authenticated (requireAuth middleware) and scoped to the
 *   requesting user — no cross-user data leakage is possible.
 *
 * ENDPOINTS:
 *   GET /api/v1/evaluation/dashboard   — aggregated KPI stats + benchmark
 *   GET /api/v1/evaluation/daily       — per-day time series data for charts
 *   GET /api/v1/evaluation/documents   — most-queried documents ranking
 *   GET /api/v1/evaluation/similarity  — similarity score histogram data
 *   GET /api/v1/evaluation/citations   — citation count distribution data
 *   GET /api/v1/evaluation/recent      — recent evaluation records (paginated)
 *   GET /api/v1/evaluation/export      — download as CSV or JSON
 *
 * QUERY PARAMS (all optional, all routes):
 *   from         — ISO date string, filter start date (e.g. "2024-01-01")
 *   to           — ISO date string, filter end date
 *   documentId   — UUID, filter to a specific document
 *   conversationId — UUID, filter to a specific conversation
 *   days         — integer, for /daily: how many days of history (default 30)
 *   limit        — integer, for /recent: records per page (default 20)
 *   offset       — integer, for /recent: pagination offset (default 0)
 *   format       — 'json' | 'csv', for /export (default 'json')
 */

import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { EvaluationService } from '../services/evaluation.service';

const router = Router();

// Apply JWT auth guard to all evaluation routes
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/dashboard
// Returns: aggregated KPI stats + benchmarking (current period vs overall)
// Used by: EvaluationDashboardPage top stat cards and benchmark section
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { from, to, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const stats = await EvaluationService.getDashboardStats(req.user.id, { 
      from, 
      to, 
      documentId, 
      conversationId,
      retrievalMode: retrievalMode as any 
    });

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/daily
// Returns: per-day aggregated metrics for the past N days
// Used by: time-series charts (questions/day, latency trends, citation trends)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { days, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const daysNum = Math.min(365, Math.max(7, parseInt(days || '30', 10)));

    const data = await EvaluationService.getDailyUsage(req.user.id, daysNum, { 
      documentId, 
      conversationId,
      retrievalMode: retrievalMode as any 
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/documents
// Returns: top N most-queried documents with avg metrics
// Used by: "Most Queried Documents" bar chart
// ─────────────────────────────────────────────────────────────────────────────
router.get('/documents', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { limit, from, to, retrievalMode } = req.query as Record<string, string>;
    const limitNum = Math.min(20, Math.max(3, parseInt(limit || '10', 10)));

    const data = await EvaluationService.getMostSearchedDocuments(req.user.id, limitNum, { 
      from, 
      to,
      retrievalMode: retrievalMode as any 
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/similarity
// Returns: similarity score histogram bucket counts
// Used by: "Similarity Score Distribution" bar chart
// ─────────────────────────────────────────────────────────────────────────────
router.get('/similarity', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { from, to, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const data = await EvaluationService.getSimilarityDistribution(req.user.id, { 
      from, 
      to, 
      documentId, 
      conversationId,
      retrievalMode: retrievalMode as any 
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/citations
// Returns: citation count distribution (0, 1, 2, 3, 4, 5+)
// Used by: "Citation Count Distribution" bar chart
// ─────────────────────────────────────────────────────────────────────────────
router.get('/citations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { from, to, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const data = await EvaluationService.getCitationDistribution(req.user.id, { 
      from, 
      to, 
      documentId, 
      conversationId,
      retrievalMode: retrievalMode as any 
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/recent
// Returns: paginated list of raw evaluation records for the data table
// Used by: "Recent Evaluations" table in the dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recent', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { limit, offset, from, to, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));
    const offsetNum = Math.max(0, parseInt(offset || '0', 10));

    const records = await EvaluationService.getRecentEvaluations(
      req.user.id, limitNum, offsetNum, { 
        from, 
        to, 
        documentId, 
        conversationId,
        retrievalMode: retrievalMode as any 
      }
    );
    res.json(records);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/export
// Returns: evaluation data as CSV or JSON file download
// Used by: "Export" button in the dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { format, from, to, documentId, conversationId, retrievalMode } = req.query as Record<string, string>;
    const exportFormat = format === 'csv' ? 'csv' : 'json';

    const data = await EvaluationService.exportEvaluations(
      req.user.id, exportFormat, { 
        from, 
        to, 
        documentId, 
        conversationId,
        retrievalMode: retrievalMode as any 
      }
    );

    const timestamp = new Date().toISOString().split('T')[0];
    if (exportFormat === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="docmind-evaluations-${timestamp}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="docmind-evaluations-${timestamp}.json"`);
    }

    res.send(data);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/evaluation/benchmark/run
// Runs semantic, hybrid, and hybrid+rerank matching stages on the same query
// ─────────────────────────────────────────────────────────────────────────────
router.post('/benchmark/run', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const { query, documentId } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Benchmark query text is required' });
    }

    const benchmarkResults = await EvaluationService.runQueryBenchmark(req.user.id, query, documentId);
    res.json(benchmarkResults);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/evaluation/benchmark/history
// Retrieves aggregated historical statistics comparing reranked and non-reranked queries
// ─────────────────────────────────────────────────────────────────────────────
router.get('/benchmark/history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const stats = await EvaluationService.getBenchmarkHistory(req.user.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;
