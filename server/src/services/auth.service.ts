import { User } from '../models/user.model';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { AppError } from '../utils/apiError';
import { generateAccessToken } from '../utils/token';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'vendor' | 'admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}

const toSafeUser = (user: any): SafeUser => ({
  id: user._id ? user._id.toString() : user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export class AuthService {
  /**
   * Registers a new customer user (public registration always creates customer role)
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Check for existing account with this email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw AppError.conflict('An account with this email address already exists');
    }

    // 2. Strict Privilege Safeguard: Public registration ALWAYS enforces 'customer' role
    const assignedRole = 'customer';

    // 3. Create user (password will be hashed by Mongoose pre-save hook)
    const user = await User.create({
      name: input.name.trim(),
      email: normalizedEmail,
      password: input.password,
      role: assignedRole,
    });

    // 4. Generate JWT access token
    const token = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      user: toSafeUser(user),
      token,
    };
  }

  /**
   * Authenticates user credentials and returns safe user data with a signed JWT
   */
  static async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Find user by email and explicitly select password hash
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // 2. Reject deactivated accounts
    if (!user.isActive) {
      throw AppError.forbidden('Your account has been deactivated. Please contact support.');
    }

    // 3. Compare password with stored bcrypt hash
    const isPasswordValid = await user.comparePassword(input.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // 4. Generate JWT access token
    const token = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return {
      user: toSafeUser(user),
      token,
    };
  }

  /**
   * Retrieves safe profile information for the authenticated user
   */
  static async getProfile(userId: string): Promise<SafeUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Your account has been deactivated. Please contact support.');
    }

    return toSafeUser(user);
  }
}
