import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import contractRoutes from './routes/contracts.js'; // Note the .js extension—required by nodenext!
import userRoutes from './routes/users.js';
import bookingRoutes from './routes/bookings.js';
import hotelRoutes from './routes/hotels.js';
import flightRoutes from './routes/flights.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// ─── Request logging middleware ─────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}${method}\x1b[0m ${url} → ${color}${status}\x1b[0m (${ms}ms)`);
  });

  // Log request body for POST/PATCH/PUT
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    const origJson = res.json.bind(res);
    let logged = false;
    // Log body after express.json() parses it
    const origNext = next;
    next = () => {
      if (!logged && req.body && Object.keys(req.body).length > 0) {
        console.log(`  ↳ body:`, JSON.stringify(req.body, null, 2).split('\n').map((l, i) => i === 0 ? l : '    ' + l).join('\n'));
        logged = true;
      }
      origNext();
    };
  }

  next();
});

app.use(cors());
app.use(express.json());

// Log response bodies for debugging
app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = (body: any) => {
    const preview = JSON.stringify(body);
    const truncated = preview.length > 500 ? preview.slice(0, 500) + `... (${preview.length} chars)` : preview;
    console.log(`  ↳ response: ${truncated}`);
    return origJson(body);
  };
  next();
});

app.use('/api/contracts', contractRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/flights', flightRoutes);

mongoose.connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('✅ TS Server connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB connection failed:', err));