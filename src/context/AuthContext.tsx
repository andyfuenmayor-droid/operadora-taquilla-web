import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSession, Agency, UserRole } from '../types';

interface AuthContextType {
  user: UserSession | null;
  agency: Agency | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usuario: string, clave: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshAgency: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('taquilla_web_user');
      const storedAgency = localStorage.getItem('taquilla_web_agency');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedAgency) {
        setAgency(JSON.parse(storedAgency));
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

        // Fallback if still no agency found: default agency record
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
    localStorage.removeItem('taquilla_web_user');
    localStorage.removeItem('taquilla_web_agency');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        agency,
        isAuthenticated: !!user,
        isLoading,
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
