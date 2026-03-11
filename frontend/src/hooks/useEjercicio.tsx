import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface EjercicioFiscal {
  id: number;
  anio: number;
  estado: 'ABIERTO' | 'CERRADO' | 'EN_CIERRE';
  fechaInicio: string;
  fechaFin: string;
  fechaCierre?: string;
  usuarioCierreId?: string;
}

interface EjercicioContextType {
  ejercicioActivo: number;
  setEjercicio: (anio: number) => void;
  esSoloLectura: boolean;
  ejercicios: EjercicioFiscal[];
  loading: boolean;
  refetch: () => void;
}

const EjercicioContext = createContext<EjercicioContextType>({
  ejercicioActivo: new Date().getFullYear(),
  setEjercicio: () => {},
  esSoloLectura: false,
  ejercicios: [],
  loading: true,
  refetch: () => {},
});

export function EjercicioProvider({ children }: { children: ReactNode }) {
  const [ejercicios, setEjercicios] = useState<EjercicioFiscal[]>([]);
  const [ejercicioActivo, setEjercicioActivo] = useState<number>(() => {
    const saved = localStorage.getItem('ejercicioActivo');
    return saved ? parseInt(saved) : new Date().getFullYear();
  });
  const [loading, setLoading] = useState(true);

  const fetchEjercicios = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    fetch('/api/ejercicios', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : [])
      .then((data: EjercicioFiscal[]) => {
        setEjercicios(data);
        // If no ejercicios exist yet, that's OK - backend will create on first call
        if (data.length > 0) {
          const activeExists = data.some(e => e.anio === ejercicioActivo);
          if (!activeExists) {
            const latest = data.find(e => e.estado === 'ABIERTO') || data[0];
            setEjercicioActivo(latest.anio);
            localStorage.setItem('ejercicioActivo', String(latest.anio));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ejercicioActivo]);

  useEffect(() => { fetchEjercicios(); }, []);

  const setEjercicio = (anio: number) => {
    setEjercicioActivo(anio);
    localStorage.setItem('ejercicioActivo', String(anio));
  };

  const ej = ejercicios.find(e => e.anio === ejercicioActivo);
  const esSoloLectura = ej?.estado === 'CERRADO';

  return (
    <EjercicioContext.Provider value={{ ejercicioActivo, setEjercicio, esSoloLectura, ejercicios, loading, refetch: fetchEjercicios }}>
      {children}
    </EjercicioContext.Provider>
  );
}

export const useEjercicio = () => useContext(EjercicioContext);
