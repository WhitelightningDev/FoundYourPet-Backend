const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seedUsers() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) throw new Error('Missing MongoDB connection string (set MONGO_URI, MONGODB_URI, or DATABASE_URL)');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const users = [
    {
      name: 'John',
      surname: 'Doe',
      contact: '123-456-7890',
      email: 'johndoe@example.com',
      password: await bcrypt.hash('password123', 10),
      address: {
        street: 'N/A',
        city: 'N/A',
        province: 'N/A',
        postalCode: '0000',
        country: 'N/A',
      },
      privacyPolicy: true,
      termsConditions: true,
      agreement: true,
    },
  ];

  await User.deleteMany({ email: { $in: users.map((u) => u.email) } });
  await User.insertMany(users);

  console.log('Users seeded successfully!');
  await mongoose.connection.close();
}

seedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding users:', error);
    process.exit(1);
  });
