// Datos tabulados para diferentes fuentes de Ir-192 HDR
// Basado en TG-43 formalism
// NOTA: Para uso clínico, verificar con datos oficiales del fabricante

import { RadialDosePoint, AnisotropyPoint } from './types'

// ============================================================================
// FUENTE: microSelectron v2 (Nucletron/Elekta)
// ============================================================================

export const microSelectronV2_RadialDose: RadialDosePoint[] = [
  { r: 0.1, gL: 1.400 },
  { r: 0.15, gL: 1.350 },
  { r: 0.2, gL: 1.300 },
  { r: 0.25, gL: 1.250 },
  { r: 0.3, gL: 1.210 },
  { r: 0.4, gL: 1.170 },
  { r: 0.5, gL: 1.148 },
  { r: 0.6, gL: 1.130 },
  { r: 0.75, gL: 1.108 },
  { r: 1.0, gL: 1.000 },
  { r: 1.5, gL: 0.987 },
  { r: 2.0, gL: 0.975 },
  { r: 2.5, gL: 0.964 },
  { r: 3.0, gL: 0.953 },
  { r: 3.5, gL: 0.943 },
  { r: 4.0, gL: 0.932 },
  { r: 4.5, gL: 0.922 },
  { r: 5.0, gL: 0.912 },
  { r: 5.5, gL: 0.902 },
  { r: 6.0, gL: 0.893 },
  { r: 6.5, gL: 0.884 },
  { r: 7.0, gL: 0.875 },
  { r: 7.5, gL: 0.867 },
  { r: 8.0, gL: 0.858 },
  { r: 8.5, gL: 0.850 },
  { r: 9.0, gL: 0.842 },
  { r: 9.5, gL: 0.834 },
  { r: 10.0, gL: 0.827 },
  { r: 11.0, gL: 0.813 },
  { r: 12.0, gL: 0.799 },
  { r: 13.0, gL: 0.786 },
  { r: 14.0, gL: 0.774 },
  { r: 15.0, gL: 0.762 }
]

export const microSelectronV2_Anisotropy: AnisotropyPoint[] = [
  // r = 1 cm
  { r: 1.0, theta: 0, F: 0.59 },
  { r: 1.0, theta: Math.PI / 12, F: 0.66 },
  { r: 1.0, theta: Math.PI / 6, F: 0.74 },
  { r: 1.0, theta: Math.PI / 4, F: 0.83 },
  { r: 1.0, theta: Math.PI / 3, F: 0.91 },
  { r: 1.0, theta: 5 * Math.PI / 12, F: 0.97 },
  { r: 1.0, theta: Math.PI / 2, F: 1.00 },
  { r: 1.0, theta: 7 * Math.PI / 12, F: 0.97 },
  { r: 1.0, theta: 2 * Math.PI / 3, F: 0.91 },
  { r: 1.0, theta: 3 * Math.PI / 4, F: 0.83 },
  { r: 1.0, theta: 5 * Math.PI / 6, F: 0.74 },
  { r: 1.0, theta: 11 * Math.PI / 12, F: 0.66 },
  { r: 1.0, theta: Math.PI, F: 0.59 },
  
  // r = 2 cm
  { r: 2.0, theta: 0, F: 0.64 },
  { r: 2.0, theta: Math.PI / 12, F: 0.70 },
  { r: 2.0, theta: Math.PI / 6, F: 0.78 },
  { r: 2.0, theta: Math.PI / 4, F: 0.86 },
  { r: 2.0, theta: Math.PI / 3, F: 0.93 },
  { r: 2.0, theta: 5 * Math.PI / 12, F: 0.98 },
  { r: 2.0, theta: Math.PI / 2, F: 1.00 },
  { r: 2.0, theta: 7 * Math.PI / 12, F: 0.98 },
  { r: 2.0, theta: 2 * Math.PI / 3, F: 0.93 },
  { r: 2.0, theta: 3 * Math.PI / 4, F: 0.86 },
  { r: 2.0, theta: 5 * Math.PI / 6, F: 0.78 },
  { r: 2.0, theta: 11 * Math.PI / 12, F: 0.70 },
  { r: 2.0, theta: Math.PI, F: 0.64 },
  
  // r = 5 cm
  { r: 5.0, theta: 0, F: 0.78 },
  { r: 5.0, theta: Math.PI / 12, F: 0.82 },
  { r: 5.0, theta: Math.PI / 6, F: 0.87 },
  { r: 5.0, theta: Math.PI / 4, F: 0.92 },
  { r: 5.0, theta: Math.PI / 3, F: 0.96 },
  { r: 5.0, theta: 5 * Math.PI / 12, F: 0.99 },
  { r: 5.0, theta: Math.PI / 2, F: 1.00 },
  { r: 5.0, theta: 7 * Math.PI / 12, F: 0.99 },
  { r: 5.0, theta: 2 * Math.PI / 3, F: 0.96 },
  { r: 5.0, theta: 3 * Math.PI / 4, F: 0.92 },
  { r: 5.0, theta: 5 * Math.PI / 6, F: 0.87 },
  { r: 5.0, theta: 11 * Math.PI / 12, F: 0.82 },
  { r: 5.0, theta: Math.PI, F: 0.78 },
  
  // r = 10 cm
  { r: 10.0, theta: 0, F: 0.88 },
  { r: 10.0, theta: Math.PI / 12, F: 0.90 },
  { r: 10.0, theta: Math.PI / 6, F: 0.93 },
  { r: 10.0, theta: Math.PI / 4, F: 0.96 },
  { r: 10.0, theta: Math.PI / 3, F: 0.98 },
  { r: 10.0, theta: 5 * Math.PI / 12, F: 0.99 },
  { r: 10.0, theta: Math.PI / 2, F: 1.00 },
  { r: 10.0, theta: 7 * Math.PI / 12, F: 0.99 },
  { r: 10.0, theta: 2 * Math.PI / 3, F: 0.98 },
  { r: 10.0, theta: 3 * Math.PI / 4, F: 0.96 },
  { r: 10.0, theta: 5 * Math.PI / 6, F: 0.93 },
  { r: 10.0, theta: 11 * Math.PI / 12, F: 0.90 },
  { r: 10.0, theta: Math.PI, F: 0.88 }
]

// ============================================================================
// FUENTE: Bravos (Varian) - PLACEHOLDER
// TODO: Añadir datos de Calatayud et al. cuando estén disponibles
// ============================================================================

export const bravos_RadialDose: RadialDosePoint[] = [
  // PLACEHOLDER - Reemplazar con datos reales de Calatayud
  // Referencia: Calatayud et al., Med Phys (año)
  { r: 1.0, gL: 1.000 }
]

export const bravos_Anisotropy: AnisotropyPoint[] = [
  // PLACEHOLDER - Reemplazar con datos reales de Calatayud
  { r: 1.0, theta: Math.PI / 2, F: 1.00 }
]

// ============================================================================
// CONFIGURACIÓN DE FUENTES
// ============================================================================

export interface SourceConfig {
  name: string
  manufacturer: string
  model: string
  doseRateConstant: number // Lambda (cGy/h/U)
  activeLength: number // L (cm)
  halfLife: number // días
  radialDoseData: RadialDosePoint[]
  anisotropyData: AnisotropyPoint[]
}

export const SOURCES: Record<string, SourceConfig> = {
  'microSelectron-v2': {
    name: 'microSelectron v2',
    manufacturer: 'Nucletron/Elekta',
    model: 'microSelectron v2',
    doseRateConstant: 1.108,
    activeLength: 0.35,
    halfLife: 73.83,
    radialDoseData: microSelectronV2_RadialDose,
    anisotropyData: microSelectronV2_Anisotropy
  },
  'bravos': {
    name: 'Bravos',
    manufacturer: 'Varian',
    model: 'Bravos',
    doseRateConstant: 1.108, // TODO: Verificar valor exacto
    activeLength: 0.35, // TODO: Verificar valor exacto
    halfLife: 73.83,
    radialDoseData: bravos_RadialDose,
    anisotropyData: bravos_Anisotropy
  }
}

// Fuente por defecto
export const DEFAULT_SOURCE = SOURCES['microSelectron-v2']

// Constantes para Ir-192 (compatibilidad con código existente)
export const IR192_CONSTANTS = {
  doseRateConstant: DEFAULT_SOURCE.doseRateConstant,
  activeLength: DEFAULT_SOURCE.activeLength,
  halfLife: DEFAULT_SOURCE.halfLife
}

// Exports para compatibilidad con código existente
export const radialDoseData = DEFAULT_SOURCE.radialDoseData
export const anisotropyData = DEFAULT_SOURCE.anisotropyData
