import React from 'react';
import { HomeDashboard } from '../HomeDashboard/HomeDashboard';
import { DateRangeReportTab } from '../DateRangeReport/DateRangeReportTab';
import { DailySalesTab } from './DailySalesTab';
import { AwardedTicketsTab } from '../AwardedTickets/AwardedTicketsTab';
import { ExpensesTab } from './ExpensesTab';
import { PaymentsTab } from './PaymentsTab';
import { BankTransfersTab } from './BankTransfersTab';
import { CashClosureTab } from './CashClosureTab';

interface CashierTerminalProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const CashierTerminal: React.FC<CashierTerminalProps> = ({ currentTab, onTabChange }) => {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {currentTab === 'inicio' && <HomeDashboard onNavigate={onTabChange} />}
      {currentTab === 'reporte' && <DateRangeReportTab />}
      {currentTab === 'ventas' && <DailySalesTab />}
      {currentTab === 'premios' && <AwardedTicketsTab />}
      {currentTab === 'gastos' && <ExpensesTab />}
      {currentTab === 'pagos' && <PaymentsTab />}
      {currentTab === 'banco' && <BankTransfersTab />}
      {currentTab === 'cierre' && <CashClosureTab />}
    </main>
  );
};
