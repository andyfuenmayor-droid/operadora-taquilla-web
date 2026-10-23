import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import type { Agency, Grupo } from '../../types';
import {
  Handshake,
  Printer,
  Copy,
  Check,
  Search,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface AgencyGroupRow {
  agenciaId: number | string;
  nombreAgencia: string;
  moneda: string;
  ventaBruta: number;
  premios: number;
  comisionAgencia: number;
  ventaNeta: number;
  cobros: number;
  gastos: number;
  saldoAgencia: number;
  difComision: number;
  difParticipacion: number;
  gananciaGrupo: number;
  status: 'CUADRADO' | 'PENDIENTE' | 'A FAVOR';
}

export const GroupReportTab: React.FC = () => {
  const { user, systemCycle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDIENTE' | 'CUADRADO' | 'A FAVOR'>('all');

  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [daughterAgencies, setDaughterAgencies] = useState<Agency[]>([]);
  const [salesRecords, setSalesRecords] = useState<any[]>([]);
  const [dailyPayments, setDailyPayments] = useState<any[]>([]);
  const [bankPayments, setBankPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const grupoId = user?.grupo_id;
  const grupoNombre = user?.grupo_nombre || user?.nombre || 'Grupo';

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar datos del grupo
      let grpData: Grupo | null = null;
      if (grupoId) {
        const { data } = await supabase.table('grupos').select('*').eq('id', grupoId).maybeSingle();
        if (data) grpData = data;
      }
      if (!grpData && grupoNombre) {
        const { data } = await supabase.table('grupos').select('*').ilike('nombre_grupo', grupoNombre).maybeSingle();
        if (data) grpData = data;
      }
      setGrupo(grpData);

      // 2. Cargar agencias del árbol
      let agList: Agency[] = [];
      const { data: allAg } = await supabase.table('agencias').select('*');
      if (allAg) {
        agList = allAg.filter((a: any) => {
          const matchId = grpData?.id && (Number(a.grupo_id) === Number(grpData.id));
          const matchNom = grupoNombre && (
            String(a.grupo_nombre || '').trim().toUpperCase() === grupoNombre.trim().toUpperCase() ||
            String(a.grupo || '').trim().toUpperCase() === grupoNombre.trim().toUpperCase()
          );
          return matchId || matchNom;
        });
      }
      setDaughterAgencies(agList);

      const agNames = agList.map((a) => a.nombre_agencia.toUpperCase());
      const agCleanNames = agList.map((a) => a.nombre_agencia.replace(/^AGENCIA\s+/i, '').trim().toUpperCase());

      // 3. Cargar ventas del ciclo
      let rawSales: any[] = [];
      const { data: salesCarga } = await supabase.table('carga_actual').select('*');
      if (salesCarga && salesCarga.length > 0) {
        rawSales = salesCarga;
      } else {
        const { data: salesDiarias } = await supabase.table('cda_reportes_diarios').select('*');
        if (salesDiarias) rawSales = salesDiarias;
      }

      // Filtrar ventas de las agencias del árbol
      const scopedSales = rawSales.filter((s: any) => {
        const sNom = String(s.agencia || s.nombre_agency || '').trim().toUpperCase();
        const sClean = sNom.replace(/^AGENCIA\s+/i, '').trim();
        return agNames.includes(sNom) || agCleanNames.includes(sClean);
      });
      setSalesRecords(scopedSales);

      // 4. Cargar pagos y gastos de las agencias del árbol
      const { data: dpData } = await supabase.table('cda_pagos_diarios').select('*');
      const { data: bpData } = await supabase.table('cda_pagos_bancarios').select('*').eq('confirmado', true);
      const { data: expData } = await supabase.table('cda_gastos_diarios').select('*');

      const filterByTree = (items: any[] | null) => {
        return (items || []).filter((item: any) => {
          const nom = String(item.agencia || item.nombre_agency || '').trim().toUpperCase();
          const clean = nom.replace(/^AGENCIA\s+/i, '').trim();
          return agNames.includes(nom) || agCleanNames.includes(clean);
        });
      };

      setDailyPayments(filterByTree(dpData));
      setBankPayments(filterByTree(bpData));
      setExpenses(filterByTree(expData));
    } catch (err) {
      console.error('Error loading group report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [grupoId, grupoNombre]);

  // Parse grupo conditions
  const groupConditions: Record<string, any> = useMemo(() => {
    if (!grupo?.condiciones_sistemas) return {};
    try {
      return typeof grupo.condiciones_sistemas === 'string'
        ? JSON.parse(grupo.condiciones_sistemas)
        : grupo.condiciones_sistemas;
    } catch {
      return {};
    }
  }, [grupo?.condiciones_sistemas]);

  // Rows calculation per agency and currency
  const calculatedRows: AgencyGroupRow[] = useMemo(() => {
    const rows: AgencyGroupRow[] = [];

    daughterAgencies.forEach((ag) => {
      const agNom = ag.nombre_agencia.toUpperCase();
      const cleanNom = agNom.replace(/^AGENCIA\s+/i, '').trim();

      const agMonedas = ag.monedas
        ? ag.monedas.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean)
        : ['BS', 'USD', 'COP'];

      agMonedas.forEach((mon) => {
        const agSales = salesRecords.filter((s: any) => {
          const sMon = String(s.moneda || 'BS').trim().toUpperCase();
          if (sMon !== mon) return false;
          const sNom = String(s.agencia || s.nombre_agency || '').trim().toUpperCase();
          const sClean = sNom.replace(/^AGENCIA\s+/i, '').trim();
          return sNom === agNom || sClean === cleanNom;
        });

        let ventaBruta = 0;
        let premios = 0;
        let comisionAg = 0;
        let comisionGrpTotal = 0;
        let difComision = 0;
        let difParticipacion = 0;

        agSales.forEach((s: any) => {
          const v = Number(s.venta ?? s.monto_venta ?? s.monto_ventas ?? 0);
          const p = Number(s.premios ?? s.monto_premios ?? 0);
          const sys = String(s.sistema || '').toUpperCase();

          ventaBruta += v;
          premios += p;

          // Agencia conditions
          let agComPct = Number(ag.comision || 10);
          let agPartPct = Number(ag.participacion_ag || 0);

          try {
            const agCond = typeof ag.condiciones_sistemas === 'string' ? JSON.parse(ag.condiciones_sistemas) : ag.condiciones_sistemas;
            const combo = agCond?.[`${sys}_${mon}`] || agCond?.[sys];
            if (combo?.comision !== undefined) agComPct = Number(combo.comision);
            if (combo?.participacion !== undefined) agPartPct = Number(combo.participacion);
          } catch (_) {}

          // Grupo conditions
          const grpCombo = groupConditions[`${sys}_${mon}`] || groupConditions[sys] || {};
          const grpComPct = grpCombo.comision !== undefined && grpCombo.comision !== null && grpCombo.comision !== ''
            ? Number(grpCombo.comision)
            : Number(grupo?.comision_pct_default || 15);
          const grpPartPct = grpCombo.participacion !== undefined && grpCombo.participacion !== null && grpCombo.participacion !== ''
            ? Number(grpCombo.participacion)
            : Number(grupo?.participacion_pct_default || 0);

          const comAgThis = v * (agComPct / 100);
          const comGrpThis = v * (grpComPct / 100);

          comisionAg += comAgThis;
          comisionGrpTotal += comGrpThis;
          difComision += Math.max(0, comGrpThis - comAgThis);

          const baseNeta = v - comGrpThis - p;
          if (baseNeta > 0 && grpPartPct > agPartPct) {
            difParticipacion += baseNeta * ((grpPartPct - agPartPct) / 100);
          }
        });

        // Cobros (Bancos + Efectivo)
        const agDP = dailyPayments.filter((p: any) => {
          const pMon = String(p.moneda || 'BS').trim().toUpperCase();
          if (pMon !== mon) return false;
          const pNom = String(p.agencia || p.nombre_agency || '').trim().toUpperCase();
          return pNom === agNom || pNom.replace(/^AGENCIA\s+/i, '').trim() === cleanNom;
        });
        const agBP = bankPayments.filter((p: any) => {
          const pMon = String(p.moneda || 'BS').trim().toUpperCase();
          if (pMon !== mon) return false;
          const pNom = String(p.agencia || p.nombre_agency || '').trim().toUpperCase();
          return pNom === agNom || pNom.replace(/^AGENCIA\s+/i, '').trim() === cleanNom;
        });

        const cobros =
          agDP.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0) +
          agBP.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);

        // Gastos
        const agExp = expenses.filter((g: any) => {
          const gMon = String(g.moneda || 'BS').trim().toUpperCase();
          if (gMon !== mon) return false;
          const gNom = String(g.agencia || g.nombre_agency || '').trim().toUpperCase();
          return gNom === agNom || gNom.replace(/^AGENCIA\s+/i, '').trim() === cleanNom;
        });
        const gastos = agExp.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);

        const ventaNeta = ventaBruta - comisionAg - premios;
        const saldoAgencia = Math.round((ventaNeta - cobros - gastos) * 100) / 100;
        const gananciaGrupo = Math.round((difComision + difParticipacion) * 100) / 100;

        const status: 'CUADRADO' | 'PENDIENTE' | 'A FAVOR' =
          saldoAgencia > 0.01 ? 'PENDIENTE' : saldoAgencia < -0.01 ? 'A FAVOR' : 'CUADRADO';

        rows.push({
          agenciaId: ag.id,
          nombreAgencia: ag.nombre_agencia,
          moneda: mon,
          ventaBruta: Math.round(ventaBruta * 100) / 100,
          premios: Math.round(premios * 100) / 100,
          comisionAgencia: Math.round(comisionAg * 100) / 100,
          ventaNeta: Math.round(ventaNeta * 100) / 100,
          cobros: Math.round(cobros * 100) / 100,
          gastos: Math.round(gastos * 100) / 100,
          saldoAgencia,
          difComision: Math.round(difComision * 100) / 100,
          difParticipacion: Math.round(difParticipacion * 100) / 100,
          gananciaGrupo,
          status,
        });
      });
    });

    return rows;
  }, [daughterAgencies, salesRecords, dailyPayments, bankPayments, expenses, groupConditions, grupo]);

  // KPI summary by currency
  const kpiByCurrency = useMemo(() => {
    const map: Record<
      string,
      {
        ventaTotal: number;
        premiosTotal: number;
        netoRecaudar: number;
        difComision: number;
        difParticipacion: number;
        gananciaGrupo: number;
        balanceComercializadora: number;
        countAgencias: number;
      }
    > = {};

    calculatedRows.forEach((r) => {
      if (!map[r.moneda]) {
        map[r.moneda] = {
          ventaTotal: 0,
          premiosTotal: 0,
          netoRecaudar: 0,
          difComision: 0,
          difParticipacion: 0,
          gananciaGrupo: 0,
          balanceComercializadora: 0,
          countAgencias: 0,
        };
      }
      map[r.moneda].ventaTotal += r.ventaBruta;
      map[r.moneda].premiosTotal += r.premios;
      map[r.moneda].netoRecaudar += r.saldoAgencia;
      map[r.moneda].difComision += r.difComision;
      map[r.moneda].difParticipacion += r.difParticipacion;
      map[r.moneda].gananciaGrupo += r.gananciaGrupo;
      map[r.moneda].balanceComercializadora += (r.saldoAgencia - r.gananciaGrupo);
      map[r.moneda].countAgencias += 1;
    });

    return map;
  }, [calculatedRows]);

  // Filtered rows for the table
  const filteredRows = useMemo(() => {
    return calculatedRows.filter((r) => {
      if (selectedCurrency !== 'ALL' && r.moneda !== selectedCurrency) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!r.nombreAgencia.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [calculatedRows, selectedCurrency, statusFilter, searchQuery]);

  // WhatsApp share generator
  const handleCopyWhatsApp = () => {
    const lines = [
      `🤝 *REPORTE DE OPERACIÓN Y AUDITORÍA DE RED*`,
      `🏷️ *Grupo:* ${grupoNombre}`,
      `📅 *Ciclo:* ${systemCycle?.tipo === 'SEMANAL' ? 'Semana' : 'Ciclo'} ${systemCycle?.semana || 'Actual'} (${systemCycle?.desde || ''} al ${systemCycle?.hasta || ''})`,
      `🏢 *Agencias en Red:* ${daughterAgencies.length} agencias`,
      `----------------------------------------`,
      `📊 *RESUMEN CONSOLIDADO POR DIVISA:*`,
    ];

    Object.entries(kpiByCurrency).forEach(([mon, k]) => {
      lines.push(
        `\n💰 *DIVISA ${mon}:*`,
        `• Venta Red: ${formatCurrency(k.ventaTotal, mon)}`,
        `• Premios: -${formatCurrency(k.premiosTotal, mon)}`,
        `• Por Cobrar Agencias: ${formatCurrency(k.netoRecaudar, mon)}`,
        `• Ganancia Dif. Comisión: +${formatCurrency(k.difComision, mon)}`
      );
      if (k.difParticipacion > 0) {
        lines.push(`• Ganancia Dif. Participación: +${formatCurrency(k.difParticipacion, mon)}`);
      }
      lines.push(
        `⭐ *GANANCIA TOTAL GRUPO:* ${formatCurrency(k.gananciaGrupo, mon)}`,
        `🏛️ *Balance Neto Comercializadora:* ${formatCurrency(k.balanceComercializadora, mon)}`
      );
    });

    lines.push(
      `----------------------------------------`,
      `📋 *ESTADO POR AGENCIA:*`
    );

    filteredRows.forEach((r) => {
      const emoji = r.status === 'CUADRADO' ? '🟢' : r.status === 'PENDIENTE' ? '🔴' : '🔵';
      lines.push(
        `${emoji} *${r.nombreAgencia}* (${r.moneda}): Venta ${formatCurrency(r.ventaBruta, r.moneda)} | Cobrar: ${formatCurrency(r.saldoAgencia, r.moneda)} | Ganancia: +${formatCurrency(r.gananciaGrupo, r.moneda)}`
      );
    });

    lines.push(
      `----------------------------------------`,
      `🏛️ _Generado desde Taquilla Web el ${new Date().toLocaleDateString('es-VE')}_`
    );

    const fullMsg = lines.filter(Boolean).join('\n');
    navigator.clipboard.writeText(fullMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0D1B22] via-[#10242E] to-[#0D1B22] border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold">
              <Handshake className="w-3.5 h-3.5" />
              <span>Portal de Auditoría y Liquidación para Grupos</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>{grupoNombre}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-normal">
                {daughterAgencies.length} agencias en árbol
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Ciclo {systemCycle?.tipo === 'SEMANAL' ? 'Semanal' : 'Diario'} • Semana {systemCycle?.semana || 'Actual'} ({systemCycle?.desde || ''} al {systemCycle?.hasta || ''})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-2 transition-all border border-slate-700 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              <span>Actualizar</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Compartir WhatsApp'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards por Divisa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Object.entries(kpiByCurrency).map(([mon, k]) => {
          const flag = mon === 'BS' ? '🇻🇪' : mon === 'USD' ? '🇺🇸' : mon === 'COP' ? '🇨🇴' : '🌐';
          return (
            <div
              key={mon}
              className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl select-none">{flag}</span>
                  <div>
                    <span className="text-xs font-black text-white font-mono uppercase">{mon}</span>
                    <span className="text-[10px] text-slate-400 block font-sans">
                      {k.countAgencias} agencias activas
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] border border-purple-500/30">
                  Red Grupo
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Venta Total Red:</span>
                  <span className="text-white font-bold">{formatCurrency(k.ventaTotal, mon)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Premios Pagados:</span>
                  <span className="text-rose-400">-{formatCurrency(k.premiosTotal, mon)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Por Cobrar a Agencias:</span>
                  <span className="text-amber-400 font-bold">{formatCurrency(k.netoRecaudar, mon)}</span>
                </div>

                <div className="my-2 p-2 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                  <div className="flex justify-between text-purple-300">
                    <span>Dif. Comisión (+):</span>
                    <span className="font-bold">+{formatCurrency(k.difComision, mon)}</span>
                  </div>
                  {k.difParticipacion > 0 && (
                    <div className="flex justify-between text-purple-300">
                      <span>Dif. Participación (+):</span>
                      <span className="font-bold">+{formatCurrency(k.difParticipacion, mon)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-400 font-black text-xs pt-1 border-t border-purple-500/30">
                    <span>Ganancia Neta Grupo:</span>
                    <span>+{formatCurrency(k.gananciaGrupo, mon)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-slate-800 text-slate-200">
                  <span>Balance Comercializadora:</span>
                  <span className={k.balanceComercializadora >= 0 ? 'text-sky-400' : 'text-rose-400'}>
                    {formatCurrency(k.balanceComercializadora, mon)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros de Tabla */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar agencia de su red..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#071217] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#071217] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-medium cursor-pointer"
          >
            <option value="ALL">Todas las Monedas</option>
            {Object.keys(kpiByCurrency).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-[#071217] border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500 font-medium cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="PENDIENTE">🔴 Pendiente por Cobrar</option>
            <option value="CUADRADO">🟢 Cuadrado (Al Día)</option>
            <option value="A FAVOR">🔵 Saldo a Favor Agencia</option>
          </select>
        </div>
      </div>

      {/* Tabla Desglosada Agencia por Agencia */}
      <div className="bg-[#0D1B22] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>Desglose por Agencia ({filteredRows.length} registros)</span>
          </h3>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[#071217] text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 text-left font-sans">Agencia</th>
                <th className="py-3 px-3 text-center font-sans">Moneda</th>
                <th className="py-3 px-3 text-right">Venta Bruta</th>
                <th className="py-3 px-3 text-right">Premios</th>
                <th className="py-3 px-3 text-right">Venta Neta</th>
                <th className="py-3 px-3 text-right">Cobrado</th>
                <th className="py-3 px-3 text-right">Gastos</th>
                <th className="py-3 px-3 text-right font-black text-amber-400">Por Cobrar</th>
                <th className="py-3 px-3 text-right font-black text-emerald-400">Ganancia Grupo</th>
                <th className="py-3 px-4 text-center font-sans">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron agencias ni ventas para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.agenciaId}_${row.moneda}`} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-white whitespace-nowrap">
                      {row.nombreAgencia}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {row.moneda}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatCurrency(row.ventaBruta, row.moneda)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-400">
                      -{formatCurrency(row.premios, row.moneda)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatCurrency(row.ventaNeta, row.moneda)}
                    </td>
                    <td className="py-3 px-3 text-right text-sky-400">
                      {row.cobros > 0 ? `-${formatCurrency(row.cobros, row.moneda)}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-400">
                      {row.gastos > 0 ? `-${formatCurrency(row.gastos, row.moneda)}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-amber-400">
                      {formatCurrency(row.saldoAgencia, row.moneda)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-400">
                      +{formatCurrency(row.gananciaGrupo, row.moneda)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-sans ${
                          row.status === 'PENDIENTE'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : row.status === 'CUADRADO'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
