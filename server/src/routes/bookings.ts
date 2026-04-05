import { Router, Request, Response } from 'express';
import mongoose from 'mongoose'; // Add this import at the top
import Booking from '../models/Booking.js';
import User from '../models/User.js';

const router: Router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, itemId, itemModel, startDate, endDate, totalPrice } = req.body;

    // 1. Basic validation of the incoming model type
    if (!['Hotel', 'Flight'].includes(itemModel)) {
      res.status(400).json({ error: "itemModel must be either 'Hotel' or 'Flight'" });
      return;
    }

    // 2. Fetch User and the specific Item (Hotel or Flight)
    // We use mongoose.model(itemModel) to dynamically select the collection
    const [user, item] = await Promise.all([
      User.findById(userId),
      mongoose.model(itemModel).findById(itemId)
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (!item) {
      res.status(404).json({ error: `${itemModel} deal not found with ID: ${itemId}` });
      return;
    }

    // 3. Check Inventory
    if (item.inventory <= 0) {
      res.status(400).json({ error: "This deal is currently sold out." });
      return;
    }

    // 4. Create the Booking
    const newBooking = new Booking({
      userId,
      itemId,
      itemModel, 
      userName: user.fullName,
      providerName: item.providerName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      totalPrice
    });

    const savedBooking = await newBooking.save();

    // 5. Decrement Inventory in the specific collection
    await mongoose.model(itemModel).findByIdAndUpdate(itemId, { $inc: { inventory: -1 } });

    res.status(201).json({
      message: "Booking confirmed!",
      booking: savedBooking
    });
  } catch (err: any) {
    console.error("Booking Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;