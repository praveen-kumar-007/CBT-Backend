/**
 * Seeds the fixed `demo` organization with two sections and 10 MCQs each (demo paper).
 * Run: node scripts/seedDemoPaper.js  (requires MONGO_URI in .env)
 */
require("dotenv").config();
const dns = require("dns");
const mongoose = require("mongoose");

const User = require("../src/models/User");
const Section = require("../src/models/Section");
const Question = require("../src/models/Question");
const ExamConfig = require("../src/models/ExamConfig");

const PART_A_QUESTIONS = [
  {
    questionText: "What is 48 + 27?",
    options: ["65", "75", "85", "95"],
    correctOptionIndex: 0,
  },
  {
    questionText: "What is 84 − 39?",
    options: ["35", "45", "55", "65"],
    correctOptionIndex: 1,
  },
  {
    questionText: "What is 12 × 8?",
    options: ["86", "96", "106", "116"],
    correctOptionIndex: 1,
  },
  {
    questionText: "What is 144 ÷ 12?",
    options: ["10", "11", "12", "13"],
    correctOptionIndex: 2,
  },
  {
    questionText: "Find the HCF of 24 and 36.",
    options: ["6", "12", "18", "24"],
    correctOptionIndex: 1,
  },
  {
    questionText: "Find the LCM of 6 and 8.",
    options: ["12", "18", "24", "48"],
    correctOptionIndex: 2,
  },
  {
    questionText: "If all angles of a triangle are 60°, the triangle is:",
    options: ["Right", "Scalene", "Isosceles", "Equilateral"],
    correctOptionIndex: 3,
  },
  {
    questionText: "Perimeter of a square with side 9 cm is:",
    options: ["18 cm", "27 cm", "36 cm", "45 cm"],
    correctOptionIndex: 2,
  },
  {
    questionText: "What is 25% of 200?",
    options: ["25", "40", "50", "75"],
    correctOptionIndex: 2,
  },
  {
    questionText: "A number increased by 15 gives 52. The number is:",
    options: ["27", "37", "47", "57"],
    correctOptionIndex: 1,
  },
];

const PART_B_QUESTIONS = [
  {
    questionText: "Who is known as the Father of the Nation in India?",
    options: ["Subhas Chandra Bose", "Jawaharlal Nehru", "Mahatma Gandhi", "Sardar Patel"],
    correctOptionIndex: 2,
  },
  {
    questionText: "What is the capital of India?",
    options: ["Mumbai", "Kolkata", "Chennai", "New Delhi"],
    correctOptionIndex: 3,
  },
  {
    questionText: "Which planet is called the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    correctOptionIndex: 1,
  },
  {
    questionText: "How many continents are there on Earth?",
    options: ["5", "6", "7", "8"],
    correctOptionIndex: 2,
  },
  {
    questionText: "Which is the largest ocean?",
    options: ["Indian", "Atlantic", "Arctic", "Pacific"],
    correctOptionIndex: 3,
  },
  {
    questionText: "Which gas do plants absorb for photosynthesis?",
    options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    correctOptionIndex: 2,
  },
  {
    questionText: "Who wrote the Indian National Anthem?",
    options: ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Sarojini Naidu", "Premchand"],
    correctOptionIndex: 0,
  },
  {
    questionText: "National animal of India is:",
    options: ["Lion", "Tiger", "Elephant", "Leopard"],
    correctOptionIndex: 1,
  },
  {
    questionText: "India became independent in:",
    options: ["1945", "1946", "1947", "1950"],
    correctOptionIndex: 2,
  },
  {
    questionText: "SI unit of force is:",
    options: ["Joule", "Pascal", "Watt", "Newton"],
    correctOptionIndex: 3,
  },
];

const seed = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  await mongoose.connect(mongoUri, {
    family: 4,
    serverSelectionTimeoutMS: 15000,
  });

  let demoAdmin = await User.findOne({ role: "admin", tenantKey: "demo" });
  if (!demoAdmin) {
    demoAdmin = await User.create({
      name: "Demo Organization",
      email: `demo-org-${Date.now()}@demo.cbt.local`,
      password: process.env.DEMO_ORG_PASSWORD || "DemoOrg123!",
      role: "admin",
      tenantKey: "demo",
      studentLimit: 99999,
    });
    console.log("Created demo organization admin:", demoAdmin.email);
  } else {
    console.log("Using existing demo organization admin:", demoAdmin.email);
  }

  await ExamConfig.findOneAndUpdate(
    { tenantAdmin: demoAdmin._id },
    {
      tenantAdmin: demoAdmin._id,
      durationInMinutes: 30,
      examinerName: "CBT Demo Paper",
      startAt: null,
      forceEndedAt: null,
      autoSubmitAfterTime: true,
      updatedBy: demoAdmin._id,
    },
    { upsert: true, new: true },
  );

  const ensureSection = async (name, description) => {
    let section = await Section.findOne({ tenantAdmin: demoAdmin._id, name });
    if (!section) {
      section = await Section.create({
        tenantAdmin: demoAdmin._id,
        name,
        description,
        isActive: true,
        isDemo: true,
      });
      console.log("Created section:", name);
    } else {
      await Section.updateOne(
        { _id: section._id },
        { $set: { isDemo: true, isActive: true, description } },
      );
      section = await Section.findById(section._id);
      console.log("Updated section:", name);
    }
    return section;
  };

  const sectionA = await ensureSection(
    "Demo Paper — Part A",
    "Quantitative & logical practice (10 questions).",
  );
  const sectionB = await ensureSection(
    "Demo Paper — Part B",
    "General awareness practice (10 questions).",
  );

  const seedQuestions = async (sectionDoc, items) => {
    const existing = await Question.countDocuments({ section: sectionDoc._id });
    if (existing >= 10) {
      console.log(`Section "${sectionDoc.name}" already has ${existing} questions — skipping inserts.`);
      return;
    }

    await Question.deleteMany({ section: sectionDoc._id });

    const rows = items.map((q) => ({
      tenantAdmin: demoAdmin._id,
      section: sectionDoc._id,
      questionText: q.questionText,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      marks: 1,
      createdBy: demoAdmin._id,
      isDemo: true,
    }));

    await Question.insertMany(rows);
    console.log(`Inserted ${rows.length} questions into "${sectionDoc.name}".`);
  };

  await seedQuestions(sectionA, PART_A_QUESTIONS);
  await seedQuestions(sectionB, PART_B_QUESTIONS);

  console.log("\nDemo paper seed finished.");
  console.log("Students can use Try Demo on the login screen (guest session).");
  console.log("Super admins manage content under sidebar: Demo Paper.");
};

seed()
  .catch((error) => {
    console.error("Demo paper seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
