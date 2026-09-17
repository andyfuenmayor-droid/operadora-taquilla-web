import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { HomeDashboard } from '../HomeDashboard/HomeDashboard';
import { DateRangeReportTab } from '../DateRangeReport/DateRangeReportTab';
import { ExpensesTab } from './ExpensesTab';
import { PaymentsTab } from './PaymentsTab';
import { BankTransfersTab } from './BankTransfersTab';
import { CashClosureTab } from './CashClosureTab';
import { AgencyCycleHistoryTab } from './AgencyCycleHistoryTab';

interface CashierTerminalProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const CashierTerminal: React.FC<CashierTerminalProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const role = (user?.rol || 'cajero').toLowerCase();

  // Permisos de módulos por rol
  const allowedTabsByRole: Record<string, string[]> = {
    cajero: ['inicio', 'reporte', 'historial', 'gastos', 'pagos', 'banco', 'cierre'],
    supervisor: ['inicio', 'reporte', 'historial', 'gastos', 'pagos', 'cierre'],
    admin: ['inicio', 'reporte', 'historial', 'gastos', 'pagos', 'banco', 'cierre'],
    agencia: ['inicio', 'reporte', 'historial', 'pagos', 'banco'],
    cobrador: ['inicio']
  };

  const allowedTabs = allowedTabsByRole[role] || allowedTabsByRole.cajero;
  const isTabAllowed = allowedTabs.includes(currentTab);

  useEffect(() => {
    if (!isTabAllowed) {
      onTabChange('inicio');
    }
  }, [isTabAllowed, onTabChange]);

  const activeTab = isTabAllowed ? currentTab : 'inicio';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {activeTab === 'inicio' && <HomeDashboard onNavigate={onTabChange} />}
      {activeTab === 'reporte' && <DateRangeReportTab />}
      {activeTab === 'historial' && <AgencyCycleHistoryTab />}
      {activeTab === 'gastos' && <ExpensesTab />}
      {activeTab === 'pagos' && <PaymentsTab />}
      {activeTab === 'banco' && <BankTransfersTab />}
      {activeTab === 'cierre' && <CashClosureTab />}
    </main>
  );
};
