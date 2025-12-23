
import React from 'react';
import { useMeetingSession } from '../hooks/useMeetingSession';
import { calculateInterest } from '../services/InterestCalculator';
import { LoanStatus } from '../types';

const MeetingWorkflow: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const {
    step, setStep,
    members, loans, group,
    attendance, toggleAttendance,
    savingsCollected, updateSaving,
    repayments, updateRepayment,
    disbursements, updateDisbursement,
    finalizeMeeting
  } = useMeetingSession();

  const handleNext = () => {
    if (step === 'ATTENDANCE') setStep('SAVINGS');
    else if (step === 'SAVINGS') setStep('REPAYMENT');
    else if (step === 'REPAYMENT') setStep('DISBURSEMENT');
    else if (step === 'DISBURSEMENT') setStep('SUMMARY');
    else {
      finalizeMeeting();
      onFinish();
    }
  };

  const handlePrev = () => {
    if (step === 'SAVINGS') setStep('ATTENDANCE');
    else if (step === 'REPAYMENT') setStep('SAVINGS');
    else if (step === 'DISBURSEMENT') setStep('REPAYMENT');
    else if (step === 'SUMMARY') setStep('DISBURSEMENT');
  };

  const renderAttendance = () => (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
      {members.map(m => (
        <div 
          key={m.id} 
          onClick={() => toggleAttendance(m.id)}
          className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${attendance.includes(m.id) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}
        >
          <span className="font-semibold text-lg">{m.name}</span>
          <div className={`w-6 h-6 rounded-full border-2 ${attendance.includes(m.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
            {attendance.includes(m.id) && <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>}
          </div>
        </div>
      ))}
    </div>
  );

  const renderSavings = () => (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">Collect Savings</h2>
      <p className="text-slate-500 mb-2 italic">Standard group saving: ₹{group.monthlySaving}</p>
      {members.filter(m => attendance.includes(m.id)).map(m => (
        <div key={m.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <label className="block text-sm font-medium text-slate-700">{m.name}</label>
          <input 
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2 bg-slate-50"
            placeholder={`Default ₹${group.monthlySaving}`}
            value={savingsCollected[m.id] || ''}
            onChange={(e) => updateSaving(m.id, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  );

  const renderRepayments = () => {
    const activeLoans = loans.filter(l => l.status === LoanStatus.ACTIVE && attendance.includes(l.memberId));
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold mb-2">Loan Repayments</h2>
        {activeLoans.length === 0 && <p className="text-slate-400 py-10 text-center">No active loans for members present.</p>}
        {activeLoans.map(l => {
          const member = members.find(m => m.id === l.memberId);
          const interestDue = calculateInterest(l);
          return (
            <div key={l.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex justify-between mb-2">
                <span className="font-bold">{member?.name}</span>
                <span className="text-indigo-600 text-sm font-medium">Interest Due: ₹{interestDue}</span>
              </div>
              <div className="text-sm text-slate-500 mb-2">Current Balance: ₹{l.balanceRemaining}</div>
              <input 
                type="number"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2 bg-slate-50"
                placeholder="Enter repayment amount"
                value={repayments[l.memberId] || ''}
                onChange={(e) => updateRepayment(l.memberId, Number(e.target.value))}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderDisbursements = () => (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">New Disbursements</h2>
      {members.filter(m => attendance.includes(m.id)).map(m => (
        <div key={m.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <label className="block text-sm font-medium text-slate-700">Issue Loan to {m.name}</label>
          <input 
            type="number"
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2 bg-slate-50"
            placeholder="Loan amount (leave 0 if none)"
            value={disbursements[m.id] || ''}
            onChange={(e) => updateDisbursement(m.id, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  );

  const renderSummary = () => {
    // Cast values to number[] to avoid 'unknown' type errors during reduction
    const totalSavings = (Object.values(savingsCollected) as number[]).reduce((a, b) => a + b, 0);
    const totalRepayments = (Object.values(repayments) as number[]).reduce((a, b) => a + b, 0);
    const totalDisbursed = (Object.values(disbursements) as number[]).reduce((a, b) => a + b, 0);

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Meeting Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="text-sm text-green-600">Total Collected</div>
            <div className="text-2xl font-black text-green-700">₹{totalSavings + totalRepayments}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <div className="text-sm text-red-600">Total Given</div>
            <div className="text-2xl font-black text-red-700">₹{totalDisbursed}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 divide-y">
           <div className="flex justify-between py-2"><span className="text-slate-500">Attendance</span> <span className="font-semibold">{attendance.length} / {members.length}</span></div>
           <div className="flex justify-between py-2"><span className="text-slate-500">Savings</span> <span className="font-semibold">₹{totalSavings}</span></div>
           <div className="flex justify-between py-2"><span className="text-slate-500">Repayments</span> <span className="font-semibold">₹{totalRepayments}</span></div>
        </div>
        <p className="text-sm text-slate-400 italic text-center">Confirm to save the ledger permanently.</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{step}</span>
          <span className="text-sm text-indigo-600 font-bold">Step {['ATTENDANCE','SAVINGS','REPAYMENT','DISBURSEMENT','SUMMARY'].indexOf(step) + 1} of 5</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-300" 
            style={{ width: `${((['ATTENDANCE','SAVINGS','REPAYMENT','DISBURSEMENT','SUMMARY'].indexOf(step) + 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 p-6 pb-32">
        {step === 'ATTENDANCE' && renderAttendance()}
        {step === 'SAVINGS' && renderSavings()}
        {step === 'REPAYMENT' && renderRepayments()}
        {step === 'DISBURSEMENT' && renderDisbursements()}
        {step === 'SUMMARY' && renderSummary()}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-50/80 backdrop-blur-md border-t flex gap-4">
        {step !== 'ATTENDANCE' && (
          <button 
            onClick={handlePrev}
            className="flex-1 py-4 px-6 rounded-2xl bg-slate-200 text-slate-700 font-bold text-lg active:scale-95 transition-transform"
          >
            Back
          </button>
        )}
        <button 
          onClick={handleNext}
          className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          {step === 'SUMMARY' ? 'Confirm & Close' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default MeetingWorkflow;
