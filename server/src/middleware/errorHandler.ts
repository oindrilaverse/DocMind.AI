import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  errors?: Record<string, string[]>;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${req.method} ${req.url} - Status ${statusCode}:`, err);

  res.status(statusCode).json({
    message,
    errors: err.errors,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
