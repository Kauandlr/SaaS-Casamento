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

export type HouseholdPlan = {
  id: string;
  budgetCents: number;
  allocatedSavingsCents: number;
  includeInGeneral: boolean;
  targetDate: string;
  housingType: string;
};

export type HouseholdCategory = {
  id: string;
  name: string;
  position: number;
};

export type HouseholdItem = {
  id: string;
  categoryId: string | null;
  name: string;
  desiredQuantity: number;
  acquiredQuantity: number;
  priority: string;
  status: string;
  estimatedUnitCents: number;
  minPriceCents: number;
  maxPriceCents: number;
  actualPaidCents: number;
  brand: string;
  model: string;
  store: string;
  productUrl: string;
  responsible: string;
  owner: string;
  notes: string;
  giftIntent: string;
  purchaseTiming: string;
  desiredDate: string | null;
  purchasedAt: string | null;
  warrantyMonths: number;
  warrantyEndsAt: string | null;
  imageUrl: string;
  favorite: boolean;
};

export type HouseholdGift = {
  id: string;
  itemId: string;
  quantity: number;
  giver: string;
  giftedAt: string;
  approximateValueCents: number;
  notes: string;
};

export type HouseholdChecklistItem = {
  id: string;
  title: string;
  responsible: string;
  dueDate: string;
  status: string;
};

export type HouseholdPayment = {
  id: string;
  itemId: string;
  itemName: string;
  installmentNumber: number;
  amountCents: number;
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
  household: {
    plan: HouseholdPlan;
    categories: HouseholdCategory[];
    items: HouseholdItem[];
    gifts: HouseholdGift[];
    checklist: HouseholdChecklistItem[];
    payments: HouseholdPayment[];
  };
};
