
import { Loan } from '../types';

export const calculateMonthlyInterest = (loan: Loan): number => {
  const monthlyRate = (loan.interestRate / 12) / 100;
  return Math.round(loan.balanceRemaining * monthlyRate);
};

// Add calculateInterest as an alias to fix import errors in MeetingWorkflow
export const calculateInterest = calculateMonthlyInterest;

// Implement processRepayment for workflow logic
export const processRepayment = (loan: Loan, amount: number) => {
  const interestDue = calculateMonthlyInterest(loan);
  const interestPaid = Math.min(interestDue, amount);
  const principalPaid = Math.max(0, amount - interestPaid);
  const newBalance = Math.max(0, loan.balanceRemaining - principalPaid);
  
  return { 
    interestPaid, 
    principalPaid, 
    newBalance 
  };
};

export const getLoanSummary = (loan: Loan) => {
  const interestDue = calculateMonthlyInterest(loan);
  return {
    interestDue,
    totalDue: interestDue + loan.balanceRemaining,
    principal: loan.balanceRemaining
  };
};
