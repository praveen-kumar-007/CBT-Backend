const User = require("../models/User");
const Section = require("../models/Section");
const Question = require("../models/Question");
const ExamConfig = require("../models/ExamConfig");

const DEMO_TENANT_KEY = "demo";
const DEMO_ORG_PASSWORD = process.env.DEMO_ORG_PASSWORD || "DemoOrg123!";

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

const ensureSection = async (tenantAdmin, name, description, createdBy) => {
  let section = await Section.findOne({ tenantAdmin, name });
  if (!section) {
    section = await Section.create({
      tenantAdmin,
      name,
      description,
      isActive: true,
      isDemo: true,
      createdBy,
    });
  } else {
    section.name = name;
    section.description = description;
    section.isActive = true;
    section.isDemo = true;
    await section.save();
  }
  return section;
};

const seedQuestionsForSection = async (section, tenantAdmin, questions, createdBy) => {
  const existingCount = await Question.countDocuments({ tenantAdmin, section: section._id });
  if (existingCount >= questions.length) {
    return { section: section.name, status: 'skipped', existingQuestions: existingCount };
  }

  await Question.deleteMany({ tenantAdmin, section: section._id });

  const rows = questions.map((question) => ({
    tenantAdmin,
    section: section._id,
    questionText: question.questionText,
    options: question.options,
    correctOptionIndex: question.correctOptionIndex,
    marks: 1,
    createdBy,
    isDemo: true,
  }));

  await Question.insertMany(rows);
  return { section: section.name, status: 'created', questionsCreated: rows.length };
};

const seedDemoPaper = async (createdBy) => {
  let demoAdmin = await User.findOne({ role: 'admin', tenantKey: DEMO_TENANT_KEY });
  if (!demoAdmin) {
    try {
      demoAdmin = await User.create({
        name: 'Demo Organization',
        email: `demo-org-${Date.now()}@demo.cbt.local`,
        password: DEMO_ORG_PASSWORD,
        role: 'admin',
        tenantKey: DEMO_TENANT_KEY,
        studentLimit: 99999,
        createdBy: createdBy || null,
      });
    } catch (error) {
      // If the demo organization already exists or another admin record was created concurrently,
      // fall back to an existing demo admin and preserve password hashing behavior.
      demoAdmin = await User.findOne({ role: 'admin', tenantKey: DEMO_TENANT_KEY });
      if (!demoAdmin) {
        throw error;
      }
    }
  } else if (!demoAdmin.studentLimit || demoAdmin.studentLimit < 99999) {
    demoAdmin.studentLimit = 99999;
    await demoAdmin.save();
  }

  if (!demoAdmin) {
    throw new Error('Failed to create or find the demo organization admin.');
  }

  await ExamConfig.findOneAndUpdate(
    { tenantAdmin: demoAdmin._id },
    {
      tenantAdmin: demoAdmin._id,
      durationInMinutes: 30,
      examinerName: 'CBT Demo Paper',
      startAt: null,
      forceEndedAt: null,
      autoSubmitAfterTime: true,
      updatedBy: createdBy || demoAdmin._id,
    },
    { upsert: true, new: true },
  );

  const sectionA = await ensureSection(
    demoAdmin._id,
    'Demo Paper — Part A',
    'Quantitative & logical practice (10 questions).',
    createdBy || demoAdmin._id,
  );

  const sectionB = await ensureSection(
    demoAdmin._id,
    'Demo Paper — Part B',
    'General awareness practice (10 questions).',
    createdBy || demoAdmin._id,
  );

  const resultA = await seedQuestionsForSection(
    sectionA,
    demoAdmin._id,
    PART_A_QUESTIONS,
    createdBy || demoAdmin._id,
  );
  const resultB = await seedQuestionsForSection(
    sectionB,
    demoAdmin._id,
    PART_B_QUESTIONS,
    createdBy || demoAdmin._id,
  );

  return {
    demoAdmin: {
      id: demoAdmin._id,
      email: demoAdmin.email,
      tenantKey: demoAdmin.tenantKey,
    },
    sections: [resultA, resultB],
  };
};

module.exports = {
  seedDemoPaper,
};
