
// Add MeetingStep type for workflow management
export type MeetingStep = 'ATTENDANCE' | 'SAVINGS' | 'REPAYMENT' | 'DISBURSEMENT' | 'SUMMARY';

export enum TransactionType {
  SAVING = 'SAVING',
  REPAYMENT = 'REPAYMENT',
  DISBURSEMENT = 'DISBURSEMENT'
}

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED'
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  totalSavings: number;
}

export interface Group {
  id: string;
  name: string;
  monthlySaving: number;
  interestRate: number;
}

export interface Loan {
  id: string;
  memberId: string;
  principalAmount: number;
  balanceRemaining: number;
  interestRate: number;
  startDate: string;
  status: LoanStatus;
}

export interface Transaction {
  id: string;
  memberId: string;
  loanId?: string;
  type: TransactionType;
  amount: number;
  // Added fields for detailed repayment tracking
  interestPart?: number;
  principalPart?: number;
  date: string;
  note?: string;
}

// Added Meeting interface to track session history
export interface Meeting {
  id: string;
  date: string;
  attendance: string[];
  totalCollected: number;
  totalDisbursed: number;
}

export interface DBState {
  members: Member[];
  group: Group;
  loans: Loan[];
  transactions: Transaction[];
  // Added meetings array to state
  meetings: Meeting[];
}
