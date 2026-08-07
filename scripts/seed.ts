/**
 * scripts/seed.ts
 *
 * Populates a fresh EduTrack Supabase project with realistic sample data:
 * 10 volunteers (1 admin), 25 students, assignments, a full Grade 1-10
 * English + Math roadmap, and several weeks of progress history so the
 * dashboards and charts have something to show immediately.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS + can create auth users).
 * Run with: npm run seed
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment (.env.local)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LEVELS = ["beginner", "developing", "proficient", "advanced"] as const;
const STATUSES = ["independent", "needs_help", "not_understood"] as const;

const ENGLISH_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ["Alphabet recognition", "Phonics — short vowels", "Sight words", "Simple sentences"],
  2: ["Words", "Basic sentences", "Punctuation", "Reading aloud"],
  3: ["Sentences", "Paragraphs", "Descriptive writing", "Reading comprehension"],
  4: ["Paragraphs", "Grammar — tenses", "Story structure", "Vocabulary building"],
  5: ["Stories", "Essay writing", "Comprehension passages", "Creative writing"],
};

const MATH_TOPICS_BY_GRADE: Record<number, string[]> = {
  1: ["Counting", "Number recognition", "Addition (single digit)", "Shapes"],
  2: ["Addition", "Subtraction", "Place value", "Simple word problems"],
  3: ["Subtraction", "Multiplication tables", "Multiplication", "Time & measurement"],
  4: ["Multiplication", "Division", "Long division", "Word problems"],
  5: ["Division", "Fractions", "Equivalent fractions", "Decimals"],
};

function topicsFor(map: Record<number, string[]>, grade: number) {
  const bracket = Math.min(5, Math.max(1, Math.ceil(grade / 2)));
  return map[bracket];
}

async function seedRoadmap() {
  console.log("Seeding learning roadmap...");
  const rows: { grade: number; subject: "english" | "math"; topic: string; order_index: number }[] = [];

  for (let grade = 1; grade <= 10; grade++) {
    topicsFor(ENGLISH_TOPICS_BY_GRADE, grade).forEach((topic, i) =>
      rows.push({ grade, subject: "english", topic, order_index: i + 1 })
    );
    topicsFor(MATH_TOPICS_BY_GRADE, grade).forEach((topic, i) =>
      rows.push({ grade, subject: "math", topic, order_index: i + 1 })
    );
  }

  const { error } = await supabase.from("learning_roadmap").upsert(rows, {
    onConflict: "grade,subject,order_index",
  });
  if (error) throw error;
  console.log(`  ${rows.length} roadmap topics seeded.`);
}

async function seedVolunteers() {
  console.log("Seeding volunteers (creates real Supabase Auth users)...");
  const volunteerIds: string[] = [];

  const seedUsers = [
    { name: "Admin User", email: "admin@edutrack.dev", role: "admin" as const },
    ...Array.from({ length: 9 }, () => ({
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      role: "volunteer" as const,
    })),
  ];

  for (const u of seedUsers) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: "EduTrack123!",
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    if (error) {
      console.warn(`  Skipping ${u.email}: ${error.message}`);
      continue;
    }
    // The on_auth_user_created trigger inserts the volunteers row; patch the role.
    await supabase.from("volunteers").update({ role: u.role, phone: faker.phone.number() }).eq("id", data.user.id);
    volunteerIds.push(data.user.id);
  }

  console.log(`  ${volunteerIds.length} volunteers seeded. Login password for all: EduTrack123!`);
  return volunteerIds;
}

async function seedStudents(count = 25) {
  console.log(`Seeding ${count} students...`);
  const rows = Array.from({ length: count }, () => {
    const grade = faker.number.int({ min: 1, max: 8 });
    return {
      name: faker.person.fullName(),
      grade,
      english_level: faker.helpers.arrayElement(LEVELS),
      math_level: faker.helpers.arrayElement(LEVELS),
      guardian_name: faker.person.fullName(),
      guardian_phone: faker.phone.number(),
    };
  });

  const { data, error } = await supabase.from("students").insert(rows).select("id, grade");
  if (error) throw error;
  console.log(`  ${data.length} students seeded.`);
  return data as { id: string; grade: number }[];
}

async function seedAssignments(studentIds: string[], volunteerIds: string[]) {
  console.log("Seeding assignments...");
  const rows: { student_id: string; volunteer_id: string; assigned_by: string }[] = [];
  const admin = volunteerIds[0];

  for (const studentId of studentIds) {
    const count = faker.number.int({ min: 1, max: 2 });
    const assigned = faker.helpers.arrayElements(volunteerIds.slice(1), count);
    for (const volunteerId of assigned) {
      rows.push({ student_id: studentId, volunteer_id: volunteerId, assigned_by: admin });
    }
  }

  const { error } = await supabase.from("assignments").upsert(rows, { onConflict: "student_id,volunteer_id" });
  if (error) throw error;
  console.log(`  ${rows.length} assignments seeded.`);
}

async function seedProgress(students: { id: string; grade: number }[], volunteerIds: string[]) {
  console.log("Seeding progress history...");
  const rows: Record<string, unknown>[] = [];

  for (const student of students) {
    const sessions = faker.number.int({ min: 2, max: 6 });
    const englishTopics = topicsFor(ENGLISH_TOPICS_BY_GRADE, student.grade);
    const mathTopics = topicsFor(MATH_TOPICS_BY_GRADE, student.grade);

    for (let i = 0; i < sessions; i++) {
      const weeksAgo = sessions - i;
      const createdAt = faker.date.recent({ days: weeksAgo * 7 });
      rows.push({
        student_id: student.id,
        volunteer_id: faker.helpers.arrayElement(volunteerIds.slice(1)),
        english_topic: faker.helpers.arrayElement(englishTopics),
        english_status: faker.helpers.arrayElement(STATUSES),
        math_topic: faker.helpers.arrayElement(mathTopics),
        math_status: faker.helpers.arrayElement(STATUSES),
        homework: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }) ?? null,
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }) ?? null,
        created_at: createdAt.toISOString(),
        session_date: createdAt.toISOString().slice(0, 10),
      });
    }
  }

  // Insert in batches to avoid oversized payloads.
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from("progress").insert(rows.slice(i, i + batchSize));
    if (error) throw error;
  }
  console.log(`  ${rows.length} progress entries seeded.`);
}

async function main() {
  await seedRoadmap();
  const volunteerIds = await seedVolunteers();
  if (volunteerIds.length === 0) {
    console.error("No volunteers were created — cannot continue (assignments/progress need a volunteer_id).");
    process.exit(1);
  }
  const students = await seedStudents(25);
  await seedAssignments(students.map((s) => s.id), volunteerIds);
  await seedProgress(students, volunteerIds);

  console.log("\nSeed complete.");
  console.log("Admin login: admin@edutrack.dev / EduTrack123!");
  console.log("All other seeded volunteers share the password: EduTrack123!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
