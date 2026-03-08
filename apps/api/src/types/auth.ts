export type UserRole = "CUSTOMER" | "EMPLOYEE" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
