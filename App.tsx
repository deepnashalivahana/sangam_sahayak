
import React, { useState, useEffect } from 'react';
import { getDB, saveDB, deleteTransaction, addMember, deleteMember } from './services/mockDb';
import { TransactionType, LoanStatus, Member, Loan, Transaction } from './types';
import { calculateMonthlyInterest } from './services/InterestCalculator';
import { GoogleGenAI, Modality } from "@google/genai";

const App: React.FC = () => {
  const [view, setView] = useState<'MEMBERS' | 'HISTORY' | 'MEMBER_DETAIL' | 'ADD_MEMBER'>('MEMBERS');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [db, setDb] = useState(getDB());
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    setDb(getDB());
  }, [view]);

  const speakText = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say clearly in a helpful voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      }
    } catch (e) {
      console.error(e);
      setIsSpeaking(false);
    }
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    addMember(newName, newPhone);
    speakText(`New member ${newName} added.`);
    setNewName('');
    setNewPhone('');
    setView('MEMBERS');
  };

  const handleRemoveMember = (id: string, name: string) => {
    const hasActiveLoan = db.loans.some(l => l.memberId === id && l.status === LoanStatus.ACTIVE);
    if (hasActiveLoan) {
      speakText(`Cannot remove ${name} because they still owe a loan.`);
      alert("Member still has an active loan!");
      return;
    }

    if (confirm(`Remove ${name} from the group forever?`)) {
      deleteMember(id);
      speakText(`${name} has been removed.`);
      setView('MEMBERS');
      setSelectedMember(null);
    }
  };

  const handleAddSaving = (mId: string, amount: number) => {
    const currentDb = getDB();
    const member = currentDb.members.find(m => m.id === mId);
    if (!member || amount <= 0) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      memberId: mId,
      type: TransactionType.SAVING,
      amount,
      date: new Date().toISOString()
    };

    member.totalSavings += amount;
    currentDb.transactions.push(newTx);
    saveDB(currentDb);
    setDb(currentDb);
    speakText(`Saved ${amount} rupees for ${member.name}. Total savings is now ${member.totalSavings}`);
  };

  const handleGiveLoan = (mId: string, amount: number) => {
    const currentDb = getDB();
    const member = currentDb.members.find(m => m.id === mId);
    if (!member || amount <= 0) return;

    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      memberId: mId,
      principalAmount: amount,
      balanceRemaining: amount,
      interestRate: currentDb.group.interestRate,
      startDate: new Date().toISOString(),
      status: LoanStatus.ACTIVE
    };

    const newTx: Transaction = {
      id: `tx-loan-${Date.now()}`,
      memberId: mId,
      loanId: newLoan.id,
      type: TransactionType.DISBURSEMENT,
      amount,
      date: new Date().toISOString()
    };

    currentDb.loans.push(newLoan);
    currentDb.transactions.push(newTx);
    saveDB(currentDb);
    setDb(currentDb);
    speakText(`Gave ${amount} rupees loan to ${member.name}`);
  };

  const handleRepayLoan = (loanId: string, amount: number) => {
    const currentDb = getDB();
    const loan = currentDb.loans.find(l => l.id === loanId);
    if (!loan || amount <= 0) return;

    const interest = calculateMonthlyInterest(loan);
    const principalPaid = Math.max(0, amount - interest);
    
    const newTx: Transaction = {
      id: `tx-rep-${Date.now()}`,
      memberId: loan.memberId,
      loanId: loan.id,
      type: TransactionType.REPAYMENT,
      amount,
      date: new Date().toISOString(),
      note: `Interest: ${interest}, Principal: ${principalPaid}`
    };

    loan.balanceRemaining = Math.max(0, loan.balanceRemaining - principalPaid);
    if (loan.balanceRemaining === 0) loan.status = LoanStatus.CLOSED;

    currentDb.transactions.push(newTx);
    saveDB(currentDb);
    setDb(currentDb);
    speakText(`Received ${amount} rupees repayment. New balance is ${loan.balanceRemaining}`);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm("Delete this activity log?")) {
      deleteTransaction(id);
      setDb(getDB());
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 font-sans select-none">
      <div className="bg-indigo-600 text-white p-6 rounded-b-[3rem] shadow-lg mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black">Sangam Ledger</h1>
          <button 
            onClick={() => speakText(`The group has ${db.members.length} members. Total savings is ${db.members.reduce((a, b) => a + b.totalSavings, 0)} rupees.`)}
            className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl"
          >
            🔊
          </button>
        </div>
      </div>

      <main className="px-4 space-y-6">
        {view === 'MEMBERS' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-slate-400 font-bold uppercase text-xs tracking-widest">Member List</h2>
              <button 
                onClick={() => setView('ADD_MEMBER')}
                className="bg-green-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-md active:scale-95 transition-transform"
              >
                + New Member
              </button>
            </div>
            
            {db.members.length === 0 && (
               <div className="bg-white p-10 rounded-[2.5rem] border border-dashed border-slate-300 text-center text-slate-400">
                 Tap "+ New Member" to begin
               </div>
            )}

            {db.members.map(m => {
              const activeLoan = db.loans.find(l => l.memberId === m.id && l.status === LoanStatus.ACTIVE);
              return (
                <div 
                  key={m.id} 
                  onClick={() => { setSelectedMember(m); setView('MEMBER_DETAIL'); }}
                  className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between active:scale-95 transition-transform"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl text-indigo-600 font-bold">
                      {m.name[0]}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-slate-800">{m.name}</div>
                      <div className="flex space-x-2">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">💰 ₹{m.totalSavings}</span>
                        {activeLoan && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">📤 Loan: ₹{activeLoan.balanceRemaining}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-300 text-3xl">›</div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'ADD_MEMBER' && (
          <div className="bg-white rounded-[2.5rem] p-8 shadow-md border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black mb-6">Add New Person</h2>
            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                <input 
                  autoFocus
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Meena Bai"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">Phone Number</label>
                <input 
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-xl font-bold focus:ring-2 focus:ring-indigo-500"
                  placeholder="10 digit number"
                />
              </div>
              <div className="pt-4 space-y-3">
                <button type="submit" className="w-full bg-green-600 text-white py-5 rounded-3xl font-black text-xl shadow-lg">
                  Save Member
                </button>
                <button type="button" onClick={() => setView('MEMBERS')} className="w-full py-4 text-slate-400 font-bold">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'MEMBER_DETAIL' && selectedMember && (
          <div className="space-y-6">
             <button onClick={() => setView('MEMBERS')} className="text-indigo-600 font-bold flex items-center mb-4">
               <span className="text-2xl mr-1">←</span> Back to All
             </button>
             
             <div className="bg-white rounded-[2.5rem] p-6 shadow-md border border-slate-100">
               <h3 className="text-2xl font-black text-slate-800 mb-6">{selectedMember.name}'s Passbook</h3>
               
               <div className="grid grid-cols-1 gap-4">
                 <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-5">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <div className="text-xs font-bold text-green-600 uppercase">Total Savings</div>
                       <div className="text-4xl font-black text-green-700">₹{selectedMember.totalSavings}</div>
                     </div>
                     <div className="text-4xl">💰</div>
                   </div>
                   <button 
                     onClick={() => handleAddSaving(selectedMember.id, 200)}
                     className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-lg shadow-sm"
                   >
                     Collect ₹200
                   </button>
                 </div>

                 {db.loans.find(l => l.memberId === selectedMember.id && l.status === LoanStatus.ACTIVE) ? (
                    <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-5">
                      {(() => {
                        const loan = db.loans.find(l => l.memberId === selectedMember.id && l.status === LoanStatus.ACTIVE)!;
                        const interest = calculateMonthlyInterest(loan);
                        return (
                          <>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="text-xs font-bold text-red-600 uppercase">Loan Remaining</div>
                                <div className="text-4xl font-black text-red-700">₹{loan.balanceRemaining}</div>
                                <div className="text-xs text-red-400 font-bold mt-1">+ ₹{interest} interest</div>
                              </div>
                              <div className="text-4xl">📤</div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <button 
                                onClick={() => handleRepayLoan(loan.id, 500)}
                                className="bg-red-600 text-white py-4 rounded-2xl font-black text-lg"
                              >
                                Pay ₹500
                              </button>
                              <button 
                                onClick={() => {
                                  const amt = Number(prompt("How much did they pay?", "1000"));
                                  if(amt) handleRepayLoan(loan.id, amt);
                                }}
                                className="bg-white border-2 border-red-600 text-red-600 py-4 rounded-2xl font-black text-lg"
                              >
                                Pay Other Amount
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                 ) : (
                    <div className="bg-slate-100 border-2 border-slate-200 border-dashed rounded-3xl p-8 flex flex-col items-center text-center">
                      <div className="text-4xl mb-2">🤝</div>
                      <div className="font-bold text-slate-500 mb-4">No Loan Taken</div>
                      <button 
                        onClick={() => handleGiveLoan(selectedMember.id, 5000)}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-lg"
                      >
                        Give ₹5000 Loan
                      </button>
                    </div>
                 )}
               </div>

               <div className="mt-12 pt-8 border-t border-slate-100">
                  <button 
                    onClick={() => handleRemoveMember(selectedMember.id, selectedMember.name)}
                    className="w-full py-4 text-red-500 font-bold border-2 border-red-50 border-dashed rounded-2xl active:bg-red-50"
                  >
                    Remove Member Completely
                  </button>
               </div>
             </div>
          </div>
        )}

        {view === 'HISTORY' && (
          <div className="space-y-4 animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-black text-slate-800">History Log</h2>
            {db.transactions.length === 0 ? (
              <div className="text-center py-10 text-slate-400">No records yet.</div>
            ) : (
              db.transactions.slice().reverse().map(t => {
                const member = db.members.find(m => m.id === t.memberId);
                return (
                  <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${t.type === TransactionType.SAVING ? 'bg-green-100' : t.type === TransactionType.REPAYMENT ? 'bg-blue-100' : 'bg-red-100'}`}>
                        {t.type === TransactionType.SAVING ? '💰' : t.type === TransactionType.REPAYMENT ? '📥' : '📤'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 truncate w-32">{member?.name || 'Deleted Member'}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{t.type} • {new Date(t.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className={`font-black text-lg ${t.type === TransactionType.DISBURSEMENT ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{t.amount}
                      </div>
                      <button 
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="w-10 h-10 bg-slate-100 text-red-400 rounded-full flex items-center justify-center text-lg active:bg-red-50"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-4 flex justify-between items-center z-50">
        <button 
          onClick={() => { setView('MEMBERS'); setSelectedMember(null); }} 
          className={`flex flex-col items-center space-y-1 ${view === 'MEMBERS' || view === 'MEMBER_DETAIL' || view === 'ADD_MEMBER' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <span className="text-2xl">👥</span>
          <span className="text-[10px] font-black uppercase">Members</span>
        </button>
        <button 
          onClick={() => setView('HISTORY')} 
          className={`flex flex-col items-center space-y-1 ${view === 'HISTORY' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <span className="text-2xl">📖</span>
          <span className="text-[10px] font-black uppercase">History</span>
        </button>
        <button 
          onClick={() => speakText(`Tap New Member to add someone. Tap a member to see their pots. Savings is green, Loan is red.`)}
          className="flex flex-col items-center space-y-1 text-slate-400"
        >
          <span className="text-2xl">❓</span>
          <span className="text-[10px] font-black uppercase">Help</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
