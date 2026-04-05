import { Router, Request, Response } from 'express';
import User from '../models/User.js';

const router: Router = Router();

/**
 * @route   POST /api/users/register
 * @desc    Create or Update user profile from Instagram bot
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { insta_tag, fullName, birthday } = req.body;

    if (!insta_tag || !fullName || !birthday) {
      res.status(400).json({ error: "Missing required fields: insta_tag, fullName, or birthday" });
      return;
    }

    // Narrowing the type to string to avoid the .toLowerCase() error
    const cleanTag = typeof insta_tag === 'string' 
      ? insta_tag.toLowerCase().trim() 
      : String(insta_tag).toLowerCase().trim();

    const user = await User.findOneAndUpdate(
      { insta_tag: cleanTag },
      { 
        fullName, 
        birthday: new Date(birthday) 
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      message: "User synced successfully",
      user
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/users/:insta_tag
 * @desc    Check if a user exists before starting onboarding
 */
router.get('/:insta_tag', async (req: Request, res: Response): Promise<void> => {
  try {
    const { insta_tag } = req.params; // or req.body

  if (typeof insta_tag !== 'string') {
    res.status(400).json({ error: "Invalid Instagram tag format" });
    return;
  }

    const cleanTag = insta_tag.toLowerCase().trim();
    const user = await User.findOne({ insta_tag: cleanTag });

    if (!user) {
      res.status(404).json({ exists: false, message: "User not found" });
      return;
    }

    res.json({ exists: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;