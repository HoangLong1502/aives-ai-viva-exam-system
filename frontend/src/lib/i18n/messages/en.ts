export const en = {
  common: {
    signOut: "Sign out",
    home: "Home",
    admin: "Admin",
    or: "or",
    languageSwitch: "Interface language",
  },
  roles: {
    student: "Student",
    teacher: "Teacher",
    admin: "Administrator",
  },
  brand: {
    tagline: "AI Viva Exam System",
    workspace: "Viva workspace",
    adminEyebrow: "Administration",
  },
  nav: {
    teacher: {
      bank: "Question bank & rubric",
      tests: "Start test",
      scores: "Scores",
    },
    student: {
      tests: "Tests",
      scores: "Scores",
    },
    admin: {
      dashboard: "Dashboard",
      people: "People",
      performance: "Performance",
      settings: "Settings",
      knowledge: "Knowledge",
    },
  },
  errors: {
    wrongRolePortal: "That screen belongs to another role.",
    adminOnly: "Only administrators can open this dashboard.",
    chooseRole: "Choose Student, Teacher, or Administrator to enter.",
    roleMismatch: "This account is a {role}. Choose that role to enter.",
    apiUnreachable: "Unable to reach the AIVES API. Is the backend running?",
  },
  login: {
    heroTitle: "An oral exam should feel like a conversation, not a lottery.",
    heroLead:
      "Adaptive viva questions, consistent scoring, and a calm room for candidates and examiners.",
    heroBullets: [
      "Questions that follow the candidate’s reasoning",
      "Shared rubrics instead of examiner drift",
      "A record of the viva, ready for review",
    ],
    heroFooter: "Built for departments that still believe in the viva.",
    createAccount: "Create account",
    signIn: "Sign in",
    joinHall: "Join the hall",
    enterHall: "Enter the hall",
    createLead: "New accounts enter as a student.",
    signInLead: "Choose a role, then sign in to open that screen.",
    roleLegend: "Role",
    name: "Name",
    email: "Email",
    password: "Password",
    passwordHint: "Passwords are at least 8 characters.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    creatingAccount: "Creating account",
    checkingCredentials: "Checking credentials",
    continue: "Continue",
    alreadyHave: "Already have an account?",
    newHere: "New here?",
    createAnAccount: "Create an account",
    welcome: "Welcome, {name}.",
  },
  home: {
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    studentLead:
      "This is your exam desk. Multiple-choice papers and oral vivas assigned to you will show up here.",
    teacherLead:
      "This is your exam hall. Sessions you are running, written or oral, will show up here.",
    upcomingVivas: "Upcoming vivas",
    noSessionsYet: "No sessions scheduled yet",
    completed: "Completed",
    resultsCollect: "Results will collect here",
    readyTitle: "Ready when you are",
    examHall: "Exam hall",
    banksNext: "Question banks and scoring next",
    vivaSessions: "Viva sessions",
    assignedList: "Assigned oral exams will appear in this list.",
    quietHall: "The hall is still quiet",
    emptyStart:
      "Once exam creation is added, candidates and examiners will open a viva from this table. Nothing is missing — this is the empty starting point.",
  },
  teacher: {
    bank: {
      eyebrow: "Question bank & rubric",
      title: "Manage viva questions",
      lead: "Import course materials, write or import oral questions, and attach Bloom levels plus scoring rubrics. AI drafts are reviewed here or when you start a test before they enter the official bank.",
      subjectTitle: "Subject & course material",
      subjectDesc:
        "Create a subject, then import a PDF, DOCX, or PPTX. Files are indexed for RAG when you draft questions at test creation.",
      codePlaceholder: "Code",
      namePlaceholder: "Subject name",
      createSubject: "Create subject",
      createSubjectFirst: "Create a subject first",
      addTitle: "Add questions",
    },
    tests: {
      eyebrow: "Tests",
      title: "Start a viva test",
      lead: "Draft oral questions from imported course material, review them, then open a session with the approved set.",
      draftTitle: "Draft from material",
      draftDesc:
        "Uses RAG over the subject's uploaded slides or textbook. Drafts stay out of the official bank until you approve them.",
      noSubjects: "No subjects yet",
    },
    scores: {
      eyebrow: "Scores",
      title: "Student results",
    },
  },
  student: {
    tests: {
      eyebrow: "Student",
      title: "Tests in progress",
      lead: "Enter a session your teacher has started. Your score appears after they record it.",
      oral: "Oral",
      multipleChoice: "Multiple choice",
      score: "Score",
      open: "Open",
      enter: "Enter",
      noQuestions: "No bank questions were attached.",
    },
    scores: {
      eyebrow: "Scores",
      title: "Your results",
    },
  },
} as const;

type DeepString<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly string[]
      ? readonly string[]
      : DeepString<T[K]>;
};

export type Messages = DeepString<typeof en>;
