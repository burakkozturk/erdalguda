export type Gender = 'MALE';

export type Customer = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  gender: Gender;
  heightCm: number | null;
  weightKg: number | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerRequest = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  heightCm?: string | number;
  weightKg?: string | number;
  address?: string;
  notes?: string;
};
