import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RoleColorMapping {
  administrador: string;
  adc: string;
  gerente: string;
  gerencia: string;
  [key: string]: string; // Allow dynamic roles if needed in the future
}

interface ConfigState {
  roleColors: RoleColorMapping;
  setRoleColor: (role: keyof RoleColorMapping | string, color: string) => void;
  resetRoleColors: () => void;
}

const defaultRoleColors: RoleColorMapping = {
  administrador: '#dc2626', // Red
  adc: '#2563eb',          // Blue
  gerente: '#16a34a',      // Green
  gerencia: '#16a34a',     // Green
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      roleColors: { ...defaultRoleColors },
      setRoleColor: (role, color) => 
        set((state) => ({
          roleColors: {
            ...state.roleColors,
            [role]: color,
          },
        })),
      resetRoleColors: () => set({ roleColors: { ...defaultRoleColors } }),
    }),
    {
      name: 'raymond-config-storage',
    }
  )
);
