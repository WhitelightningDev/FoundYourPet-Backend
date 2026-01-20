const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

const AddOn = require('./models/AddOn');
const Package = require('./models/Package');
const Membership = require('./models/Membership'); // Make sure this exists
const User = require('./models/User');
const Pet = require('./models/Pet'); // Import your Pet model

dotenv.config({ path: path.resolve(__dirname, '.env') });

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
      "Pet Profile Access",
    ],
  },
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
      "Early Access to New Features",
    ],
  },
];

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


function getAdminSeed() {
  return {
    name: process.env.ADMIN_NAME || 'Daniel',
    surname: process.env.ADMIN_SURNAME || 'Mommsen',
    contact: process.env.ADMIN_CONTACT || '0000000000',
    email: process.env.ADMIN_EMAIL || 'danielmommsen@hotmail.com',
    password: process.env.ADMIN_PASSWORD || 'Admin',
    address: {
      street: process.env.ADMIN_ADDRESS_STREET || 'N/A',
      city: process.env.ADMIN_ADDRESS_CITY || 'N/A',
      province: process.env.ADMIN_ADDRESS_PROVINCE || 'N/A',
      postalCode: process.env.ADMIN_ADDRESS_POSTAL_CODE || '0000',
      country: process.env.ADMIN_ADDRESS_COUNTRY || 'N/A',
    },
    privacyPolicy: true,
    termsConditions: true,
    agreement: true,
    isAdmin: true,
  };
}

const legacyAdminEmails = ['danielmommsen2@gmail.com'];





async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) throw new Error('Missing MongoDB connection string (set MONGO_URI, MONGODB_URI, or DATABASE_URL)');

    await mongoose.connect(mongoUri);
    console.log('🔗 Connected to MongoDB');

    const adminSeed = getAdminSeed();

    // Clear collections
    await AddOn.deleteMany({});
    await Package.deleteMany({});
    await Membership.deleteMany({});
    await Pet.deleteMany({});

    // Insert seed data
    await AddOn.insertMany(seedAddOns);
    await Package.insertMany(seedPackages);
    await Membership.insertMany(seedMemberships);

    console.log('✅ AddOns, Packages, and Memberships seeded successfully!');

    // Create/update admin user (idempotent)
    let admin = await User.findOne({ email: adminSeed.email });

    if (!admin && legacyAdminEmails.length > 0) {
      const legacyAdmin = await User.findOne({ email: { $in: legacyAdminEmails } });
      if (legacyAdmin) {
        legacyAdmin.email = adminSeed.email;
        await legacyAdmin.save();
        admin = legacyAdmin;
        console.log(`✅ Admin email updated to ${adminSeed.email}`);
      }
    }

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminSeed.password, 10);
      admin = await User.create({ ...adminSeed, password: hashedPassword });
      console.log(`✅ Admin user created (${adminSeed.email})`);
    } else {
      const update = {};
      if (!admin.isAdmin) update.isAdmin = true;
      if (process.env.ADMIN_RESET_PASSWORD === 'true') {
        update.password = await bcrypt.hash(adminSeed.password, 10);
      }
      if (process.env.ADMIN_UPDATE_PROFILE === 'true') {
        update.name = adminSeed.name;
        update.surname = adminSeed.surname;
        update.contact = adminSeed.contact;
        update.address = adminSeed.address;
        update.privacyPolicy = adminSeed.privacyPolicy;
        update.termsConditions = adminSeed.termsConditions;
        update.agreement = adminSeed.agreement;
      }

      if (Object.keys(update).length > 0) {
        await User.updateOne({ _id: admin._id }, { $set: update });
        admin = await User.findById(admin._id);
        console.log(`✅ Admin user updated (${adminSeed.email})`);
      } else {
        console.log(`⚠️ Admin user already exists (${adminSeed.email})`);
      }
    }

    // Assign the userId dynamically to each pet and insert
    const seedPets = seedPetsTemplate.map(pet => ({
      ...pet,
      userId: admin._id
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
