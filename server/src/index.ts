import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Load env before other local imports
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { db, pool } from './db';
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import searchRoutes from './routes/search.routes';
import chatRoutes from './routes/chat.routes';
import systemRoutes from './routes/system.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // allow images/files to be requested if needed
}));
app.use(cors({
  origin: CLIENT_URL,
  credentials: true, // required for refresh token cookie
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Static files (for original file reference if needed)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/system', systemRoutes);

// Base route for status check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling
app.use(errorHandler);

// Run DB migrations and start listening
async function bootstrap() {
  console.log('Bootstrapping server...');
  try {
    // Run migrations
    console.log('Checking/running database migrations...');
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    console.log('Database migrations verified successfully!');

    // Start Server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
