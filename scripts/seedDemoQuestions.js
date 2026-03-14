require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

const User = require('../src/models/User');
const Section = require('../src/models/Section');
const Question = require('../src/models/Question');

const mathsQuestions = [
  {
    questionText: 'What is 48 + 27?',
    options: ['65', '75', '85', '95'],
    correctOptionIndex: 1
  },
  {
    questionText: 'What is 84 - 39?',
    options: ['35', '45', '55', '65'],
    correctOptionIndex: 1
  },
  {
    questionText: 'What is 12 x 8?',
    options: ['86', '96', '106', '116'],
    correctOptionIndex: 1
  },
  {
    questionText: 'What is 144 / 12?',
    options: ['10', '11', '12', '13'],
    correctOptionIndex: 2
  },
  {
    questionText: 'Find the HCF of 24 and 36.',
    options: ['6', '12', '18', '24'],
    correctOptionIndex: 1
  },
  {
    questionText: 'Find the LCM of 6 and 8.',
    options: ['12', '18', '24', '48'],
    correctOptionIndex: 2
  },
  {
    questionText: 'If a triangle has angles 60 deg, 60 deg and 60 deg, it is a:',
    options: ['Right triangle', 'Scalene triangle', 'Isosceles triangle', 'Equilateral triangle'],
    correctOptionIndex: 3
  },
  {
    questionText: 'What is the perimeter of a square with side 9 cm?',
    options: ['18 cm', '27 cm', '36 cm', '45 cm'],
    correctOptionIndex: 2
  },
  {
    questionText: 'What is 25% of 200?',
    options: ['25', '40', '50', '75'],
    correctOptionIndex: 2
  },
  {
    questionText: 'A number increased by 15 gives 52. The number is:',
    options: ['27', '37', '47', '57'],
    correctOptionIndex: 1
  }
];

const gkQuestions = [
  {
    questionText: 'Who is known as the Father of the Nation in India?',
    options: ['Subhas Chandra Bose', 'Jawaharlal Nehru', 'Mahatma Gandhi', 'Sardar Patel'],
    correctOptionIndex: 2
  },
  {
    questionText: 'What is the capital of India?',
    options: ['Mumbai', 'Kolkata', 'Chennai', 'New Delhi'],
    correctOptionIndex: 3
  },
  {
    questionText: 'Which planet is called the Red Planet?',
    options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
    correctOptionIndex: 1
  },
  {
    questionText: 'How many continents are there in the world?',
    options: ['5', '6', '7', '8'],
    correctOptionIndex: 2
  },
  {
    questionText: 'Which is the largest ocean on Earth?',
    options: ['Indian Ocean', 'Atlantic Ocean', 'Arctic Ocean', 'Pacific Ocean'],
    correctOptionIndex: 3
  },
  {
    questionText: 'Which gas do plants use for photosynthesis?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctOptionIndex: 2
  },
  {
    questionText: 'Who wrote the Indian National Anthem?',
    options: ['Rabindranath Tagore', 'Bankim Chandra Chatterjee', 'Sarojini Naidu', 'Premchand'],
    correctOptionIndex: 0
  },
  {
    questionText: 'Which is the national animal of India?',
    options: ['Lion', 'Tiger', 'Elephant', 'Leopard'],
    correctOptionIndex: 1
  },
  {
    questionText: 'In which year did India become independent?',
    options: ['1945', '1946', '1947', '1950'],
    correctOptionIndex: 2
  },
  {
    questionText: 'What is the SI unit of force?',
    options: ['Joule', 'Pascal', 'Watt', 'Newton'],
    correctOptionIndex: 3
  }
];

const seed = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in .env');
  }

  dns.setServers(['8.8.8.8', '1.1.1.1']);
  await mongoose.connect(mongoUri, { family: 4, serverSelectionTimeoutMS: 15000 });

  let admin = await User.findOne({ role: 'admin' }).select('+password');
  if (!admin) {
    admin = await User.create({
      name: 'Demo Admin',
      email: `demo.admin.${Date.now()}@cbt.local`,
      password: 'admin123',
      role: 'admin'
    });
  }

  const mathsSection = await Section.findOneAndUpdate(
    { name: 'Mathematics (Class 8)' },
    {
      name: 'Mathematics (Class 8)',
      description: 'Basic mathematics questions up to class 8 level.',
      isActive: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const gkSection = await Section.findOneAndUpdate(
    { name: 'General Knowledge (Class 10)' },
    {
      name: 'General Knowledge (Class 10)',
      description: 'General knowledge questions up to class 10 level.',
      isActive: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Question.deleteMany({ section: { $in: [mathsSection._id, gkSection._id] } });

  const toInsert = [
    ...mathsQuestions.map((q) => ({ ...q, section: mathsSection._id, marks: 1, createdBy: admin._id })),
    ...gkQuestions.map((q) => ({ ...q, section: gkSection._id, marks: 1, createdBy: admin._id }))
  ];

  await Question.insertMany(toInsert);

  const mathsCount = await Question.countDocuments({ section: mathsSection._id });
  const gkCount = await Question.countDocuments({ section: gkSection._id });

  console.log('Seed completed.');
  console.log(`Section: ${mathsSection.name} -> ${mathsCount} questions`);
  console.log(`Section: ${gkSection.name} -> ${gkCount} questions`);
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
