export type UserRole =
  | 'ADMIN'
  | 'SALES'
  | 'CUTTING'
  | 'PACKAGING'
  | 'CARGO'
  | 'IRONING'
  | 'MACHINIST'
  | 'QUALITY_CONTROL'
  | 'DELIVERY'
  | 'VIP_CUSTOMER';

export type AuthUser = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  roleLabel: string;
  employeeId: number | null;
  employeeName: string | null;
  customerId: number | null;
};

export type UserResponse = AuthUser & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
  customerId: number | null;
};

export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
