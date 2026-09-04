import React from 'react';
import { DailySalesTab } from './DailySalesTab';
import { ExpensesTab } from './ExpensesTab';
import { PaymentsTab } from './PaymentsTab';
import { BankTransfersTab } from './BankTransfersTab';
import { CashClosureTab } from './CashClosureTab';

interface CashierTerminalProps {
  currentTab: string;
}

export const CashierTerminal: React.FC<CashierTerminalProps> = ({ currentTab }) => {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {currentTab === 'ventas' && <DailySalesTab />}
      {currentTab === 'gastos' && <ExpensesTab />}
      {currentTab === 'pagos' && <PaymentsTab />}
      {currentTab === 'banco' && <BankTransfersTab />}
      {currentTab === 'cierre' && <CashClosureTab />}
    </main>
  );
};
