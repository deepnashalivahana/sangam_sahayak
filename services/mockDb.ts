
import { DBState, Transaction, TransactionType, LoanStatus, Member, Loan } from '../types';

const STORAGE_KEY = 'SANGAM_SAHAYAK_DB_V2';

const initialState: DBState = {
  group: { id: 'g1', name: 'Ekta Sangam', monthlySaving: 200, interestRate: 24 },
  members: [
    { id: 'm1', name: 'Lakshmi Devi', phone: '9876543210', totalSavings: 2400 },
    { id: 'm2', name: 'Meena Bai', phone: '9876543211', totalSavings: 1800 },
    { id: 'm3', name: 'Saritha Akka', phone: '9876543212', totalSavings: 3000 },
  ],
  loans: [],
  transactions: [],
  meetings: []
};

export const getDB = (): DBState => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : initialState;
};

export const saveDB = (state: DBState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const addMember = (name: string, phone: string) => {
  const db = getDB();
  const newMember: Member = {
    id: `m-${Date.now()}`,
    name,
    phone,
    totalSavings: 0
  };
  db.members.push(newMember);
  saveDB(db);
  return newMember;
};

export const deleteMember = (id: string) => {
  const db = getDB();
  // Safety: Don't delete if they have an active loan
  const hasActiveLoan = db.loans.some(l => l.memberId === id && l.status === LoanStatus.ACTIVE);
  if (hasActiveLoan) {
    throw new Error("Cannot delete member with active loan.");
  }
  
  db.members = db.members.filter(m => m.id !== id);
  // Also clean up their transactions and loans
  db.transactions = db.transactions.filter(t => t.memberId !== id);
  db.loans = db.loans.filter(l => l.memberId !== id);
  
  saveDB(db);
};

export const deleteTransaction = (id: string) => {
  const db = getDB();
  const tx = db.transactions.find(t => t.id === id);
  if (!tx) return;

  // Revert Balances
  if (tx.type === TransactionType.SAVING) {
    const m = db.members.find(member => member.id === tx.memberId);
    if (m) m.totalSavings -= tx.amount;
  } else if (tx.type === TransactionType.REPAYMENT) {
    const l = db.loans.find(loan => loan.id === tx.loanId);
    if (l) {
      const principalToRevert = tx.principalPart ?? tx.amount;
      l.balanceRemaining += principalToRevert;
      l.status = LoanStatus.ACTIVE;
    }
  } else if (tx.type === TransactionType.DISBURSEMENT) {
    db.loans = db.loans.filter(l => l.id !== tx.loanId);
  }

  db.transactions = db.transactions.filter(t => t.id !== id);
  saveDB(db);
};
