import { db } from '../db';
import { users, refreshTokens } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, AuthResponse } from '@docmind/shared';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'super_secret_access_key_123_abc_xyz_security_docmind';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_456_def_uvw_security_docmind';

export class AuthService {
  /**
   * Hashes token to store in database securely
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generates a pair of signed JWT access and refresh tokens
   */
  private static async generateTokens(user: { id: string; email: string; name: string }): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token hash to database
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Registers a new user, hashes password, and returns user details + tokens
   */
  static async register(params: { email: string; name: string; password: string }): Promise<AuthResponse & { refreshToken: string }> {
    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, params.email),
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(params.password, salt);

    // Insert user
    const [newUser] = await db.insert(users).values({
      email: params.email,
      name: params.name,
      passwordHash,
    }).returning();

    const tokenPair = await this.generateTokens({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt.toISOString(),
      },
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  /**
   * Validates user credentials and issues tokens
   */
  static async login(params: { email: string; password: string }): Promise<AuthResponse & { refreshToken: string }> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, params.email),
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(params.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const tokenPair = await this.generateTokens({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  /**
   * Validates a refresh token, rotates tokens (invalidates old, issues new ones)
   */
  static async refresh(refreshToken: string): Promise<AuthResponse & { refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: string };
      const tokenHash = this.hashToken(refreshToken);

      // Verify token exists in database and is not expired
      const tokenRecord = await db.query.refreshTokens.findFirst({
        where: and(
          eq(refreshTokens.tokenHash, tokenHash),
          eq(refreshTokens.userId, decoded.id)
        ),
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        throw new Error('Invalid or expired refresh token');
      }

      // Delete the old refresh token (forces rotation)
      await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id));

      // Fetch user details
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokenPair = await this.generateTokens({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logs out the user by deleting their refresh token from DB
   */
  static async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  /**
   * Retrieves the current user details
   */
  static async getUserById(id: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
