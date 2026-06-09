import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Helper to set refresh token in cookie
const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth', // Only expose to auth routes
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Helper to clear refresh token cookie
const clearRefreshTokenCookie = (res: Response) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
};

// Register Route
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ message: 'Email, name, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const result = await AuthService.register({ email, name, password });
    
    setRefreshTokenCookie(res, result.refreshToken);
    
    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    if (error.message === 'Email already registered') {
      return res.status(409).json({ message: error.message });
    }
    next(error);
  }
});

// Login Route
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await AuthService.login({ email, password });
    
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
});

// Refresh Route
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    const result = await AuthService.refresh(refreshToken);
    
    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error: any) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// Logout Route
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get Current User Info
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await AuthService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
