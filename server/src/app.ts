import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import apiRouter from './routes';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
