const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // To hash passwords before saving
const User = require('./models/User');

// Connect to MongoDB (replace with your actual MongoDB URI)
mongoose.connect('mongodb://localhost:27017/yourDatabase', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Connection error:', error);
});

// Create seed data
const seedUsers = async () => {
  try {
    // Clear the User collection first (optional)
    await User.deleteMany({});

    const users = [
      {
        name: 'John',
        surname: 'Doe',
        contact: '123-456-7890',
        email: 'johndoe@example.com',
        password: await bcrypt.hash('password123', 10),
        privacyPolicy: true,
        termsConditions: true,
        agreement: true,
      },
    ];

    // Insert seed users into the database
    await User.insertMany(users);

    console.log('Users seeded successfully!');
    mongoose.connection.close(); // Close the connection after seeding
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

// Run the seed function
seedUsers();
