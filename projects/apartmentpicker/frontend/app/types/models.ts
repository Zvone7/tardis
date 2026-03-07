export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  approvedAt: string | null;
  isApproved: boolean;
}

export interface RankingCase {
  id: string;
  name: string;
  description: string | null;
  currency: string | null;
  apartmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RankingCaseSave {
  name: string;
  description: string | null;
  currency: string | null;
}

export interface Criterion {
  id: string;
  rankingCaseId: string;
  name: string;
  description: string | null;
  includeInRanking: boolean;
  dataType: "Number" | "Boolean" | "Enum" | "Text";
  unit: string | null;
  weight: number;
  missingValueHandling: "Ignore" | "TreatAsZero" | "Penalize";
  sortOrder: number;
  numericIntervals: NumericInterval[] | null;
  booleanRule: BooleanRule | null;
  enumOptions: EnumOption[] | null;
}

export interface CriterionSave {
  rankingCaseId: string;
  name: string;
  description: string | null;
  includeInRanking: boolean;
  dataType: string;
  unit: string | null;
  weight: number;
  missingValueHandling: string;
  sortOrder: number;
  numericIntervals: NumericInterval[] | null;
  booleanRule: BooleanRule | null;
  enumOptions: EnumOption[] | null;
}

export interface NumericInterval {
  id?: string;
  intervalStart: number | null;
  intervalEnd: number | null;
  score: number;
  sortOrder: number;
}

export interface BooleanRule {
  scoreWhenTrue: number;
  scoreWhenFalse: number;
}

export interface EnumOption {
  id?: string;
  value: string;
  score: number;
  sortOrder: number;
}

export interface Apartment {
  id: string;
  rankingCaseId: string;
  name: string;
  sillyName: string | null;
  link: string | null;
  comment: string | null;
  hiddenFromRanking: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  values: ApartmentCriterionValue[];
}

export interface ApartmentSave {
  rankingCaseId: string;
  name: string;
  sillyName: string | null;
  link: string | null;
  comment: string | null;
  hiddenFromRanking: boolean;
  status: string;
}

export interface ApartmentCriterionValue {
  id: string;
  apartmentId: string;
  criterionId: string;
  numberValue: number | null;
  boolValue: boolean | null;
  enumOptionId: string | null;
  textValue: string | null;
}

export interface RankedApartment {
  apartment: Apartment;
  totalScore: number;
  percentScore: number;
  criterionScores: CriterionScore[];
}

export interface CriterionScore {
  criterionId: string;
  criterionName: string;
  weight: number;
  baseScore: number | null;
  weightedScore: number | null;
  rawDisplayValue: string | null;
}
