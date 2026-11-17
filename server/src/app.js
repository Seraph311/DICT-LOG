import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config, isProduction } from './config.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import csmRouter from './routes/csm.js';
import dashboardRouter from './routes/dashboard.js';
import forecastRouter from './routes/forecast.js';
import importRouter from './routes/import.js';
import exportRouter from './routes/export.js';
import visitorsRouter from './routes/visitors.js';
import lookupsRouter from './routes/lookups.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/csm', csmRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/forecast', forecastRouter);
app.use('/api/import', importRouter);
app.use('/api/export', exportRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/lookups', lookupsRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: {
      message: status >= 500 ? 'Internal server error' : err.message,
      ...(err.fields ? { fields: err.fields } : {}),
    },
  });
});

app.set('trust proxy', config.trustProxy);

export default app;
