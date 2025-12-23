
import { useState, useCallback, useMemo } from 'react';
import { MeetingStep, Member, Loan, Transaction, TransactionType, LoanStatus } from '../types';
import { getDB, saveDB } from '../services/mockDb';
import { processRepayment } from '../services/InterestCalculator';

export const useMeetingSession = () => {
  const [step, setStep] = useState<MeetingStep>('ATTENDANCE');
  const [attendance, setAttendance] = useState<string[]>([]);
  const [savingsCollected, setSavingsCollected] = useState<Record<string, number>>({});
  const [repayments, setRepayments] = useState<Record<string, number>>({});
  const [disbursements, setDisbursements] = useState<Record<string, number>>({});

  const db = useMemo(() => getDB(), []);
  
  const toggleAttendance = (memberId: string) => {
    setAttendance(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const updateSaving = (memberId: string, amount: number) => {
    setSavingsCollected(prev => ({ ...prev, [memberId]: amount }));
  };

  const updateRepayment = (memberId: string, amount: number) => {
    setRepayments(prev => ({ ...prev, [memberId]: amount }));
  };

  const updateDisbursement = (memberId: string, amount: number) => {
    setDisbursements(prev => ({ ...prev, [memberId]: amount }));
  };

  const finalizeMeeting = useCallback(() => {
    const currentState = getDB();
    const newTransactions: Transaction[] = [];
    const date = new Date().toISOString();

    // 1. Process Savings
    // Cast Object.entries to ensure 'amount' is treated as a number
    (Object.entries(savingsCollected) as [string, number][]).forEach(([mId, amount]) => {
      if (amount <= 0) return;
      newTransactions.push({
        id: `t-sav-${Date.now()}-${mId}`,
        memberId: mId,
        type: TransactionType.SAVING,
        amount,
        date
      });
      const mIdx = currentState.members.findIndex(m => m.id === mId);
      if (mIdx > -1) currentState.members[mIdx].totalSavings += amount;
    });

    // 2. Process Repayments
    // Cast Object.entries to ensure 'amount' is treated as a number
    (Object.entries(repayments) as [string, number][]).forEach(([mId, amount]) => {
      if (amount <= 0) return;
      const activeLoan = currentState.loans.find(l => l.memberId === mId && l.status === LoanStatus.ACTIVE);
      if (activeLoan) {
        const { interestPaid, principalPaid, newBalance } = processRepayment(activeLoan, amount);
        newTransactions.push({
          id: `t-rep-${Date.now()}-${mId}`,
          memberId: mId,
          loanId: activeLoan.id,
          type: TransactionType.REPAYMENT,
          amount,
          interestPart: interestPaid,
          principalPart: principalPaid,
          date
        });
        activeLoan.balanceRemaining = newBalance;
        if (newBalance <= 0) activeLoan.status = LoanStatus.CLOSED;
      }
    });

    // 3. Process New Disbursements
    // Cast Object.entries to ensure 'amount' is treated as a number
    (Object.entries(disbursements) as [string, number][]).forEach(([mId, amount]) => {
      if (amount <= 0) return;
      const newLoan: Loan = {
        id: `l-new-${Date.now()}-${mId}`,
        memberId: mId,
        principalAmount: amount,
        balanceRemaining: amount,
        interestRate: currentState.group.interestRate,
        startDate: date,
        status: LoanStatus.ACTIVE
      };
      currentState.loans.push(newLoan);
      newTransactions.push({
        id: `t-dis-${Date.now()}-${mId}`,
        memberId: mId,
        loanId: newLoan.id,
        type: TransactionType.DISBURSEMENT,
        amount,
        date
      });
    });

    currentState.transactions.push(...newTransactions);
    
    const meetingSummary = {
      id: `meet-${Date.now()}`,
      date,
      attendance,
      // Cast Object.values and reduce to ensure numbers are handled correctly
      totalCollected: (Object.values(savingsCollected) as number[]).reduce((a, b) => a + b, 0) + (Object.values(repayments) as number[]).reduce((a, b) => a + b, 0),
      totalDisbursed: (Object.values(disbursements) as number[]).reduce((a, b) => a + b, 0)
    };
    currentState.meetings.push(meetingSummary);

    saveDB(currentState);
    return meetingSummary;
  }, [attendance, savingsCollected, repayments, disbursements]);

  return {
    step,
    setStep,
    attendance,
    toggleAttendance,
    savingsCollected,
    updateSaving,
    repayments,
    updateRepayment,
    disbursements,
    updateDisbursement,
    finalizeMeeting,
    members: db.members,
    loans: db.loans,
    group: db.group
  };
};
