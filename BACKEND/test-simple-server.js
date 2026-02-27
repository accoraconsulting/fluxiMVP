import express from 'express';

const app = express();
const PORT = 3000;

app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Simple test server running on ${PORT}`);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n⚠️ Shutting down...');
  process.exit(0);
});

console.log('🟢 Server is waiting for requests...');
