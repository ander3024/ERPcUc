import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
export const errorHandler = (err: any, req: Request, res: Response, _: NextFunction) => {
  logger.error(err.message, { stack: err.stack, path: req.path });
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
};
