require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seedUsers() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(process.env.MONGO_URI);
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
