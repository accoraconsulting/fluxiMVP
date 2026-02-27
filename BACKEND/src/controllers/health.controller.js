import { checkDatabase } from '../services/health.service.js';

export async function healthCheck(req, res) {
  try {
    const dbOk = await checkDatabase();

    res.json({
      status: 'ok',
      database: dbOk ? 'connected' : 'error'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
}
