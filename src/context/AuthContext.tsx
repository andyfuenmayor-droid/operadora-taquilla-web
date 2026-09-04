import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSession, Agency, UserRole, SystemCycle } from '../types';
import { normalizarMoneda, getTodayDateString } from '../utils/formatters';

interface AuthContextType {
  user: UserSession | null;
  agency: Agency | null;
  systemCycle: SystemCycle | null;
  assignedSystems: string[];
  assignedCurrencies: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isDayClosed: boolean;
  checkDayClosedStatus: (dateStr?: string) => Promise<boolean>;
  login: (usuario: string, clave: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshAgency: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [systemCycle, setSystemCycle] = useState<SystemCycle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDayClosed, setIsDayClosed] = useState<boolean>(false);

  // Compute active assigned systems
  const assignedSystems = React.useMemo(() => {
    if (!agency?.sistemas) return ['BETM3'];
    const list = String(agency.sistemas)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && !['NONE', 'NAN'].includes(s));
    return list.length > 0 ? list : ['BETM3'];
  }, [agency?.sistemas]);

  // Compute active assigned currencies
  const assignedCurrencies = React.useMemo(() => {
    if (!agency?.monedas) return ['BS'];
    const list = String(agency.monedas)
      .split(',')
      .map((m) => normalizarMoneda(m))
      .filter((m) => m && !['NONE', 'NAN'].includes(m));
    return list.length > 0 ? Array.from(new Set(list)) : ['BS'];
  }, [agency?.monedas]);

  // Fetch active working cycle from config_sistema
  const fetchSystemCycle = useCallback(async (userId?: string | number) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const defaultCycle: SystemCycle = {
      desde: monday.toISOString().slice(0, 10),
      hasta: sunday.toISOString().slice(0, 10),
      tipo: 'SEMANAL',
      semana: 'Actual',
    };

    try {
      let q = supabase.table('config_sistema').select('parametro, valor');
      if (userId) {
        q = q.eq('user_id', String(userId).trim());
      }
      const { data } = await q;

      const confData = data && data.length > 0 ? data : (await supabase.table('config_sistema').select('parametro, valor')).data;

      if (confData && confData.length > 0) {
        const confMap: Record<string, string> = {};
        confData.forEach((row: any) => {
          if (row.parametro) {
            confMap[String(row.parametro).trim().toLowerCase()] = String(row.valor || '').trim();
          }
        });

        setSystemCycle({
          desde: confMap['fecha_desde'] || defaultCycle.desde,
          hasta: confMap['fecha_hasta'] || defaultCycle.hasta,
          tipo: confMap['tipo_cierre'] || defaultCycle.tipo,
          semana: confMap['semana_no'] || defaultCycle.semana,
        });
        return;
      }
    } catch (e) {
      console.warn('Could not fetch config_sistema:', e);
    }
    setSystemCycle(defaultCycle);
  }, []);

  const checkDayClosedStatus = useCallback(async (dateStr?: string): Promise<boolean> => {
    const targetDate = dateStr || getTodayDateString();
    const agName = agency?.nombre_agencia;
    if (!agName) return false;

    try {
      let q = supabase
        .table('saldo_taquilla')
        .select('cerrado')
        .eq('fecha', targetDate)
        .ilike('nombre_agency', agName);

      if (user?.rol === 'cajero' && user.id) {
        q = q.eq('cajero_id', String(user.id));
      }

      const { data } = await q.maybeSingle();
      const closed = !!data?.cerrado;
      setIsDayClosed(closed);
      return closed;
    } catch {
      return false;
    }
  }, [agency?.nombre_agencia, user?.rol, user?.id]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('taquilla_web_user');
      const storedAgency = localStorage.getItem('taquilla_web_agency');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setUser(u);
        fetchSystemCycle(u.user_id);
      }
      if (storedAgency) {
        setAgency(JSON.parse(storedAgency));
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSystemCycle]);

  useEffect(() => {
    if (agency?.nombre_agencia) {
      checkDayClosedStatus();
    }
  }, [agency?.nombre_agencia, checkDayClosedStatus]);

  const refreshAgency = async () => {
    if (!agency?.id && !user?.agencia_id) return;
    const agencyId = agency?.id || user?.agencia_id;
    try {
      const { data } = await supabase
        .table('agencias')
        .select('*')
        .eq('id', agencyId)
        .maybeSingle();

      if (data) {
        setAgency(data);
        localStorage.setItem('taquilla_web_agency', JSON.stringify(data));
      }
    } catch (e) {
      console.error('Error refreshing agency:', e);
    }
  };

  const login = async (usuarioInput: string, claveInput: string): Promise<{ success: boolean; message?: string }> => {
    const uClean = usuarioInput.trim();
    const pClean = claveInput.trim();

    if (!uClean || !pClean) {
      return { success: false, message: 'Por favor ingrese usuario y contraseña.' };
    }

    try {
      let matchedUser: UserSession | null = null;
      let matchedAgency: Agency | null = null;

      // 1. Search in taquilla_usuarios
      const { data: usersData, error: userErr } = await supabase
        .table('taquilla_usuarios')
        .select('*')
        .ilike('usuario', uClean);

      if (!userErr && usersData && usersData.length > 0) {
        for (const u of usersData) {
          if (String(u.clave || '').trim() === pClean) {
            matchedUser = {
              id: u.id,
              usuario: u.usuario,
              nombre: u.nombre_cajero || u.usuario,
              rol: (u.rol ? u.rol.toLowerCase() : 'cajero') as UserRole,
              agencia_id: u.agencia_id,
              terminal_id: u.terminal_id,
              user_id: u.user_id,
              activo: u.activo ?? true,
            };
            break;
          }
        }
      }

      // 2. Search in agencias table if not matched
      if (!matchedUser) {
        const { data: agData, error: agErr } = await supabase
          .table('agencias')
          .select('*')
          .ilike('usuario_taquilla', uClean);

        if (!agErr && agData && agData.length > 0) {
          for (const ag of agData) {
            if (String(ag.clave_taquilla || '').trim() === pClean) {
              matchedAgency = ag;
              matchedUser = {
                id: `ag_${ag.id}`,
                usuario: ag.usuario_taquilla || uClean,
                nombre: ag.nombre_agencia || uClean,
                rol: 'agencia',
                agencia_id: ag.id,
                user_id: ag.user_id,
                activo: true,
              };
              break;
            }
          }
        }
      }

      // 3. Search in cda_cobradores table if not matched
      if (!matchedUser) {
        const { data: cobData, error: cobErr } = await supabase
          .table('cda_cobradores')
          .select('*')
          .ilike('usuario', uClean);

        if (!cobErr && cobData && cobData.length > 0) {
          for (const cob of cobData) {
            if (String(cob.clave || '').trim() === pClean) {
              if (cob.activo === false) {
                return { success: false, message: 'Este cobrador se encuentra inactivo. Contacte al Administrador.' };
              }
              matchedUser = {
                id: cob.id,
                usuario: cob.usuario,
                nombre: cob.nombre || cob.usuario,
                rol: 'cobrador',
                agencia_id: 'cobrador',
                user_id: cob.user_id,
                cedula_identidad: cob.cedula_identidad,
                telefono: cob.telefono,
                activo: true,
              };
              matchedAgency = {
                id: 0,
                nombre_agencia: 'Ruta de Cobranza',
              };
              break;
            }
          }
        }
      }

      if (!matchedUser) {
        return { success: false, message: 'Usuario o clave incorrectos.' };
      }

      // Find Agency Details if not already matched
      if (!matchedAgency) {
        if (matchedUser.rol === 'cobrador') {
          matchedAgency = { id: 0, nombre_agencia: 'Ruta de Cobranza' };
        } else if (matchedUser.agencia_id) {
          const { data: agMatch } = await supabase
            .table('agencias')
            .select('*')
            .eq('id', matchedUser.agencia_id)
            .maybeSingle();

          if (agMatch) {
            matchedAgency = agMatch;
          }
        }

        // Fallback: search by name
        if (!matchedAgency && matchedUser.nombre) {
          const { data: agNameMatch } = await supabase
            .table('agencias')
            .select('*')
            .ilike('nombre_agencia', matchedUser.nombre)
            .maybeSingle();

          if (agNameMatch) {
            matchedAgency = agNameMatch;
          }
        }

        if (!matchedAgency) {
          matchedAgency = {
            id: matchedUser.agencia_id || 1,
            nombre_agencia: matchedUser.nombre || 'Agencia General',
          };
        }
      }

      setUser(matchedUser);
      setAgency(matchedAgency);
      localStorage.setItem('taquilla_web_user', JSON.stringify(matchedUser));
      localStorage.setItem('taquilla_web_agency', JSON.stringify(matchedAgency));

      fetchSystemCycle(matchedUser.user_id || matchedAgency.user_id);
      return { success: true };
    } catch (err: unknown) {
      console.error('Login error:', err);
      return { 
        success: false, 
        message: err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setAgency(null);
    setSystemCycle(null);
    localStorage.removeItem('taquilla_web_user');
    localStorage.removeItem('taquilla_web_agency');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        agency,
        systemCycle,
        assignedSystems,
        assignedCurrencies,
        isAuthenticated: !!user,
        isLoading,
        isDayClosed,
        checkDayClosedStatus,
        login,
        logout,
        refreshAgency,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
