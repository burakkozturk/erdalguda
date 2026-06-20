export type MeasurementDefinition = {
  key: string;
  order: number;
  label: string;
  unit: string;
  imageSrc?: string;
};

export type MeasurementValueRequest = {
  definitionKey: string;
  definitionOrder: number;
  definitionLabel: string;
  numericValue?: number;
  unit?: string;
  notes?: string;
};

export type MeasurementSetRequest = {
  customerId: number;
  measuredAt?: string;
  notes?: string;
  values: MeasurementValueRequest[];
};

export type MeasurementValue = {
  id: number;
  definitionKey: string;
  definitionOrder: number;
  definitionLabel: string;
  numericValue: number;
  unit: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeasurementSet = {
  id: number;
  customerId: number;
  customerFullName: string;
  measuredAt: string;
  measuredByUserFullName: string | null;
  notes: string | null;
  values: MeasurementValue[];
  createdAt: string;
  updatedAt: string;
};
