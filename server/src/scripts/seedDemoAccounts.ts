import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { VendorProfile } from '../models/vendorProfile.model';
import { env } from '../config/env.config';

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB for demo accounts seeding...');

  const rawPassword = 'Password123!';

  const accounts = [
    { email: 'admin@example.com', name: 'Platform Admin', role: 'admin' as const, password: rawPassword, isActive: true },
    { email: 'vendor@example.com', name: 'Sample Vendor', role: 'vendor' as const, password: rawPassword, isActive: true },
    { email: 'customer@example.com', name: 'Regular Customer', role: 'customer' as const, password: rawPassword, isActive: true }
  ];

  for (const acc of accounts) {
    let user = await User.findOne({ email: acc.email });
    if (!user) {
      user = await User.create(acc);
      console.log('Created user:', acc.email, acc.role);
    } else {
      user.role = acc.role;
      user.password = rawPassword;
      user.isActive = true;
      await user.save();
      console.log('Updated user:', acc.email, acc.role);
    }

    if (acc.role === 'vendor') {
      let vp = await VendorProfile.findOne({ userId: user._id });
      if (!vp) {
        await VendorProfile.create({
          userId: user._id,
          storeName: 'Premier Store',
          description: 'Official Demo Vendor Store',
          businessEmail: 'vendor@example.com',
          businessPhone: '+1-555-0199',
          businessAddress: {
            street: '456 Market St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'USA'
          },
          status: 'approved',
          approvedAt: new Date()
        });
        console.log('Created VendorProfile for demo vendor');
      }
    }
  }

  console.log('✅ Demo users seeded successfully!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
