export type BudgetCategory = {
  id: string;
  name: string;
  plannedCents: number;
  contractedCents: number;
  paidCents: number;
};

export type Payment = {
  id: string;
  title: string;
  vendorName: string;
  categoryId: string | null;
  amountCents: number;
  dueDate: string;
  status: string;
  payer: string;
};

export type Vendor = {
  id: string;
  name: string;
  company: string;
  category: string;
  phone: string;
  email: string;
  quotedCents: number;
  status: string;
  rating: number;
  favorite: boolean;
};

export type Guest = {
  id: string;
  fullName: string;
  side: string;
  groupName: string;
  ageGroup: string;
  rsvp: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  category: string;
  responsible: string;
  priority: string;
  dueDate: string;
  status: string;
};

export type WeddingSnapshot = {
  wedding: {
    id: string;
    title: string;
    personOne: string;
    personTwo: string;
    weddingDate: string;
    city: string;
    budgetCents: number;
    savedCents: number;
    monthlyCapacityCents: number;
    reservePercent: number;
    guestEstimate: number;
  };
  categories: BudgetCategory[];
  payments: Payment[];
  vendors: Vendor[];
  guests: Guest[];
  checklist: ChecklistItem[];
};
