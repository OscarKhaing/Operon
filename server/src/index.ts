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

app.use(cors());
app.use(express.json());
app.use('/api/contracts', contractRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/flights', flightRoutes);

mongoose.connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('✅ TS Server connected to MongoDB');
    app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));
  })
  .catch(err => console.error(err));