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
// Phase 4: Evaluation Dashboard routes
import evaluationRoutes from './routes/evaluation.routes';
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
// Phase 4: AI Evaluation Dashboard API
app.use('/api/v1/evaluation', evaluationRoutes);

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

  // 1. Verify DATABASE_URL exists in the environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is not defined!');
    console.error('Please configure DATABASE_URL in your hosting platform environment variables (Render/Railway).');
    process.exit(1);
  }

  // 2. Verify PostgreSQL connection with a retry loop
  const maxRetries = 5;
  const retryDelayMs = 2000;
  let isDbConnected = false;

  console.log('Connecting to PostgreSQL database...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      isDbConnected = true;
      console.log('Successfully connected to PostgreSQL database!');
      break;
    } catch (err: any) {
      console.error(`Database connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelayMs / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  if (!isDbConnected) {
    console.error('CRITICAL ERROR: Failed to establish a database connection after multiple attempts.');
    console.error('Verify database availability, credentials, and network/firewall settings.');
    process.exit(1);
  }

  try {
    // 3. Verify pgvector extension is present in the database
    console.log('Checking for pgvector (vector) extension...');
    try {
      const extensionCheck = await pool.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      if (extensionCheck.rows.length === 0) {
        console.log('pgvector extension not active. Attempting to enable it (CREATE EXTENSION IF NOT EXISTS vector)...');
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('pgvector extension enabled successfully!');
      } else {
        console.log('pgvector extension verified active.');
      }
    } catch (extError: any) {
      console.warn(`Warning: Failed checking or enabling pgvector: ${extError.message}`);
      console.warn('The application will proceed, but similarity searches may fail if the extension is not active.');
    }

    // 4. Run database migrations using Drizzle
    console.log('Checking/running database migrations...');
    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
    console.log('Database migrations verified successfully!');

    // 5. Start Server, explicitly binding to all network interfaces (0.0.0.0) for Render/Railway compatibility
    const serverPort = Number(PORT);
    app.listen(serverPort, '0.0.0.0', () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`- Local address:  http://localhost:${serverPort}`);
      console.log(`- Network bind:   http://0.0.0.0:${serverPort}`);
    });
  } catch (error) {
    console.error('Bootstrap failed due to initialization error:', error);
    process.exit(1);
  }
}

bootstrap();

