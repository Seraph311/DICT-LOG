import app from './app.js';
import { config } from './config.js';

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  console.error(
    'FATAL: JWT_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).',
  );
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
