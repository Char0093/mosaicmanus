export type Tier = "red" | "yellow" | "green" | "blue";
export type Confidence = "guessed" | "unsure" | "knew";
export type ClassifierConfidence = "high" | "medium" | "low";

export interface Learner {
  id: string;
  name: string;
  initials: string;
  tier: Tier;
  mastery: number;
  misconception?: string;
  flagged?: boolean;
  confidentWrongCount?: number;
  confusedWrongCount?: number;
  clearedAt?: string | null;
  recent: string;
}

export interface AnswerInsight {
  id: number;
  questionId: string;
  option: string;
  correct: boolean;
  confidence: Confidence;
  feedback: string;
  reasoning?: string | null;
  classifierConfidence?: ClassifierConfidence | null;
  teacherOverrideMisconceptionId?: string | null;
  createdAt: string;
}

export interface PulseOption {
  label: string;
  value: string;
}

export interface PulseQuestion {
  id: string;
  prompt: string;
  options: PulseOption[];
  answer: string;
}

export const CLASSROOM = {
  id: "class-form2-science",
  name: "Form 2 Science",
  subject: "Science",
  topics: ["Forces & Motion", "Living Things", "Matter & Properties"],
  kioskCode: "MOSAIC01",
};

export const DEMO_LEARNERS: Learner[] = [
  { id: "s1", name: "Nur Aisyah", initials: "NA", tier: "red", mastery: 28, misconception: "Mass and weight are the same thing", flagged: true, recent: "1 min ago" },
  { id: "s2", name: "Farid Hakim", initials: "FH", tier: "red", mastery: 31, misconception: "Force is only needed to keep objects moving", flagged: true, recent: "3 min ago" },
  { id: "s3", name: "Kavitha Devi", initials: "KD", tier: "red", mastery: 34, misconception: "Mass and weight are the same thing", flagged: true, recent: "7 min ago" },
  { id: "s4", name: "Wei Jian", initials: "WJ", tier: "red", mastery: 37, misconception: "Heavier objects always fall faster", flagged: true, recent: "9 min ago" },
  { id: "s5", name: "Imran Salleh", initials: "IS", tier: "red", mastery: 39, misconception: "Mass and weight are the same thing", flagged: true, recent: "12 min ago" },
  { id: "s6", name: "Hana Yusof", initials: "HY", tier: "yellow", mastery: 58, misconception: "Mass and weight are the same thing", recent: "Just now" },
  { id: "s7", name: "Syafiq Rahman", initials: "SR", tier: "yellow", mastery: 56, misconception: "Force is only needed to keep objects moving", recent: "5 min ago" },
  { id: "s8", name: "Aiman Zaki", initials: "AZ", tier: "yellow", mastery: 62, misconception: "Heavier objects always fall faster", recent: "10 min ago" },
  { id: "s9", name: "Liyana Musa", initials: "LM", tier: "yellow", mastery: 60, misconception: "Mass and weight are the same thing", recent: "14 min ago" },
  { id: "s10", name: "Jason Lim", initials: "JL", tier: "yellow", mastery: 65, misconception: "Force is only needed to keep objects moving", recent: "17 min ago" },
  { id: "s11", name: "Siti Mariam", initials: "SM", tier: "yellow", mastery: 64, misconception: "Mass and weight are the same thing", recent: "22 min ago" },
  { id: "s12", name: "Amirul Nizam", initials: "AN", tier: "green", mastery: 73, recent: "2 min ago" },
  { id: "s13", name: "Mei Ling", initials: "ML", tier: "green", mastery: 76, recent: "8 min ago" },
  { id: "s14", name: "Danish Iskandar", initials: "DI", tier: "green", mastery: 71, recent: "15 min ago" },
  { id: "s15", name: "Priya Nair", initials: "PN", tier: "green", mastery: 78, recent: "18 min ago" },
  { id: "s16", name: "Azlan Noor", initials: "AN", tier: "green", mastery: 74, recent: "24 min ago" },
  { id: "s17", name: "Adam Ibrahim", initials: "AI", tier: "blue", mastery: 94, misconception: "Cleared: mass and weight", recent: "4 min ago", clearedAt: new Date().toISOString() },
  { id: "s18", name: "Nadia Farhana", initials: "NF", tier: "blue", mastery: 91, recent: "11 min ago" },
  { id: "s19", name: "Kumar Raj", initials: "KR", tier: "blue", mastery: 88, recent: "19 min ago" },
  { id: "s20", name: "Alia Sofia", initials: "AS", tier: "blue", mastery: 96, recent: "30 min ago" },
];

export const PULSE_QUESTIONS: PulseQuestion[] = [
  { id: "p1", prompt: "Which statement best describes mass?", options: [{ label: "A", value: "A push or pull" }, { label: "B", value: "The amount of matter in an object" }, { label: "C", value: "The pull of gravity on an object" }, { label: "D", value: "How fast an object moves" }], answer: "B" },
  { id: "p2", prompt: "An object has the same mass on Earth and on the Moon. What changes?", options: [{ label: "A", value: "Its mass" }, { label: "B", value: "Its weight" }, { label: "C", value: "Its volume" }, { label: "D", value: "Its material" }], answer: "B" },
  { id: "p3", prompt: "What tool is best for measuring weight?", options: [{ label: "A", value: "Spring balance" }, { label: "B", value: "Ruler" }, { label: "C", value: "Thermometer" }, { label: "D", value: "Stopwatch" }], answer: "A" },
];

export const tierMeta: Record<Tier, { label: string; color: string; soft: string; task: string }> = {
  red: { label: "Rebuild", color: "#d6544c", soft: "#fff0ed", task: "Rebuild the core concept with concrete examples and a teacher check-in." },
  yellow: { label: "Repair", color: "#d89b25", soft: "#fff7e4", task: "Use a paired sort-and-explain task to repair the misconception." },
  green: { label: "Practice", color: "#4f9a78", soft: "#ecf8f1", task: "Apply the concept independently with quick feedback." },
  blue: { label: "Extend", color: "#536fc9", soft: "#eef1ff", task: "Explain the concept in a fresh real-world context for a peer." },
};
