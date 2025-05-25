const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const AddOn = require('./models/AddOn');
const Package = require('./models/Package');
const Membership = require('./models/Membership'); // Make sure this exists
const User = require('./models/user');
const Pet = require('./models/Pet'); // Import your Pet model

dotenv.config();

const seedAddOns = [
  { name: "Heart-Shaped Tag", price: 30, applicableTo: ["standard"] },
  { name: "Bone-Shaped Tag", price: 35, applicableTo: ["standard"] },
  { name: "Apple AirTag", price: 800, applicableTo: ["apple"] },
  { name: "AirTag Collar Holder", price: 499, applicableTo: ["apple"] },
  { name: "Samsung Smart Tag", price: 499, applicableTo: ["samsung"] },
  { name: "Samsung Tag Holder", price: 100, applicableTo: ["samsung"] }
];

const seedPackages = [
  {
    name: "Standard Tag Package",
    type: "standard",
    price: 210,
    description: "Classic engraved QR tag with delivery and pet profile access.",
    features: [
      "25mm Nickel-Plated Tag (Rust-Proof)",
      "Engraved QR Code",
      "Delivery To Closest PUDO Locker",
      "Pet Profile Access"
    ]
  }
];

const seedMemberships = [
  {
    name: "Standard Support Membership",
    price: 50,
    billingCycle: "monthly",
    features: [
      "Ongoing Pet Profile Hosting",
      "Free Tag Replacement",
      "Priority Support",
      "Early Access to New Features"
    ]
  }
];

const adminUser = {
  name: 'admin',
  surname: 'user',
  contact: '0746588885',
  email: 'danielmommsen2@gmail.com',
  password: 'Admin',
  address: {
    street: 'N/A',
    city: 'N/A',
    province: 'N/A',
    postalCode: '0000',
    country: 'N/A'
  },
  privacyPolicy: true,
  termsConditions: true,
  agreement: true,
  isAdmin: true
};

const seedPetsTemplate = [
  {
    name: "PurrPurr",
    species: "Cat",
    breed: "Maincoon",
    age: 12,
    color: "Black",
    gender: "Female",
    photoUrl: "https://res.cloudinary.com/dyzzxilmr/image/upload/v1748113897/pet_images/j0ovk994lhl9gmjgsgny.jpg",
    tagType: "Standard",
    hasTag: true,
    tagPurchaseDate: new Date('2023-01-01'),
    // userId will be assigned dynamically below
  },
  // Add more pets if needed
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Clear collections
    await AddOn.deleteMany({});
    await Package.deleteMany({});
    await Membership.deleteMany({});
    await Pet.deleteMany({});
    await User.deleteMany({ email: adminUser.email }); // Optional: delete existing admin to avoid conflicts

    // Insert seed data
    await AddOn.insertMany(seedAddOns);
    await Package.insertMany(seedPackages);
    await Membership.insertMany(seedMemberships);

    console.log('✅ AddOns, Packages, and Memberships seeded successfully!');

    // Check for existing admin user
    let existingAdmin = await User.findOne({ email: adminUser.email });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);
      adminUser.password = hashedPassword;
      existingAdmin = await User.create(adminUser);
      console.log('✅ Admin user created!');
    } else {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Admin user updated to isAdmin=true');
      } else {
        console.log('⚠️ Admin user already exists and isAdmin is set to true.');
      }
    }

    // Assign the userId dynamically to each pet and insert
    const seedPets = seedPetsTemplate.map(pet => ({
      ...pet,
      userId: existingAdmin._id
    }));

    await Pet.insertMany(seedPets);
    console.log('✅ Pets seeded successfully!');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
