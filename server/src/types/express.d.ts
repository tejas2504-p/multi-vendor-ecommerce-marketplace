export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'vendor' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      vendorProfile?: any;
    }
  }
}

