export interface Company {
  id: string;
  name: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  companyId: string;
  active: boolean;
  miscellaneous?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  clientId: string;
  companyId: string;
  payRate: number;
  payType: 'hourly' | 'per_diem';
  startDate: string; // ISO date
  active: boolean;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'standard';
  active: boolean;
}

export interface Check {
  id: string;
  employeeId: string;
  clientId: string | null;
  companyId: string;
  amount: number;
  date: string; // ISO date
  memo?: string;
  testPrint?: boolean;
} 