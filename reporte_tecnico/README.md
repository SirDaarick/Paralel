# Reporte Técnico: Paralelización de IA para Tetris

**Proyecto Integrador - Cómputo Paralelo**  
**Ingeniería en Inteligencia Artificial**  
**Junio 2026**

---

## Índice del Reporte

Este reporte técnico documenta la paralelización de un algoritmo de inteligencia artificial para Tetris mediante búsqueda exhaustiva con look-ahead, implementado en tres enfoques: OpenMP (memoria compartida), CUDA (acelerador GPU) y MPI (memoria distribuida).

### Secciones

| # | Archivo | Sección | Palabras aprox. |
|---|---------|---------|-----------------|
| 00 | [00_portada.md](00_portada.md) | Portada | - |
| 01 | [01_resumen.md](01_resumen.md) | Resumen ejecutivo | ~350 |
| 02 | [02_introduccion.md](02_introduccion.md) | Introducción y contexto | ~900 |
| 03 | [03_descripcion_problema.md](03_descripcion_problema.md) | Descripción formal del problema | ~1100 |
| 04 | [04_analisis_complejidad.md](04_analisis_complejidad.md) | Análisis de complejidad algorítmica | ~900 |
| 05 | [05_diseno_paralelo_foster.md](05_diseno_paralelo_foster.md) | Diseño paralelo (Método de Foster) | ~1100 |
| 06 | [06_casos_estudio_teoricos.md](06_casos_estudio_teoricos.md) | Casos de estudio teóricos | ~1100 |
| 07 | [07_mediciones_empiricas.md](07_mediciones_empiricas.md) | Mediciones empíricas | ~1400 |
| 08 | [08_analisis_escalamiento.md](08_analisis_escalamiento.md) | Análisis de escalamiento | ~1100 |
| 09 | [09_depuracion_overhead.md](09_depuracion_overhead.md) | Depuración y detección de overhead | ~1200 |
| 10 | [10_evidencias_unidades.md](10_evidencias_unidades.md) | Evidencias por unidad temática | ~1900 |
| 11 | [11_conclusiones.md](11_conclusiones.md) | Conclusiones y recomendaciones | ~750 |
| 12 | [12_referencias.md](12_referencias.md) | Referencias bibliográficas | 25 refs |
| 13 | [13_codigo_fuente.md](13_codigo_fuente.md) | Anexo: Código fuente | - |

### Figuras

Todas las figuras están en la carpeta `figuras/`:

| Figura | Archivo | Descripción |
|--------|---------|-------------|
| 1 | `figura1_tiempos.png` | Tiempos de ejecución: Secuencial vs OpenMP vs CUDA |
| 3 | `figura3_amdahl.png` | Speedup real vs teórico (Ley de Amdahl) |
| 4 | `figura4_strong_scaling.png` | Strong scaling (N=3 fijo, variando hilos) |
| 5 | `figura5_isoeficiencia.png` | Función de isoeficiencia (E=80%) |
| 6 | `figura6_flynn.png` | Taxonomía de Flynn aplicada al proyecto |
| - | `figura_gustafson.png` | Ley de Gustafson (speedup escalado) |
| - | `figura_weak_scaling.png` | Weak scaling (trabajo por hilo constante) |
| - | `figura_karp_flatt.png` | Métrica de Karp-Flatt (fracción serial experimental) |

### Scripts de Generación de Gráficas

Todos los scripts están en la carpeta `scripts/`:

| Script | Descripción |
|--------|-------------|
| `graficas_tiempos.py` | Genera figura1_tiempos.png |
| `graficas_amdahl.py` | Genera figura3_amdahl.png |
| `graficas_gustafson.py` | Genera figura_gustafson.png |
| `graficas_isoeficiencia.py` | Genera figura5_isoeficiencia.png |
| `graficas_escalado.py` | Genera figura4_strong_scaling.png + figura_weak_scaling.png |
| `graficas_karp_flatt.py` | Genera figura_karp_flatt.png |
| `graficas_flynn.py` | Genera figura6_flynn.png |

Para regenerar todas las figuras:
```bash
cd reporte_tecnico/scripts
python graficas_tiempos.py
python graficas_amdahl.py
python graficas_gustafson.py
python graficas_isoeficiencia.py
python graficas_escalado.py
python graficas_karp_flatt.py
python graficas_flynn.py
```

---

## Hardware de Pruebas

- **CPU:** Intel Core i5-11300H @ 3.10 GHz (4 núcleos / 8 hilos, Tiger Lake)
- **GPU:** NVIDIA GeForce GTX 1650 (896 CUDA cores, 4 GB VRAM, Turing)
- **RAM:** DDR4
- **Compiladores:** g++ 11+ (C++17), nvcc 12.0 (CUDA C++14)

## Resultados Clave

| Implementación | Speedup (N=3) | Fracción paralela (f) | Asíntota S∞ |
|----------------|---------------|----------------------|-------------|
| OpenMP (8 hilos) | ~3.3× | 0.80 | 5.0× |
| CUDA (896 cores) | ~7.2× | 0.86 | 7.14× |
| MPI (4 procesos) | ~3.5× | 0.85 | 6.67× |

## Estructura del Proyecto

```
Paralel/
├── backend/
│   ├── src/
│   │   ├── main.cpp              # Servidor HTTP + endpoints REST
│   │   ├── tetris/
│   │   │   ├── types.h           # Tipos compartidos (Board, PieceType)
│   │   │   ├── solver.cpp        # Solver secuencial (baseline)
│   │   │   ├── solver_omp.cpp    # Solver OpenMP
│   │   │   ├── solver_cuda.cu    # Solver CUDA (kernel GPU)
│   │   │   ├── solver_mpi.cpp    # Solver MPI
│   │   │   └── simulation.h      # SimulationManager
│   │   └── httplib.h             # cpp-httplib (vendored)
│   └── Makefile                  # Build system
├── frontend/
│   ├── src/                      # React 19 + TypeScript + Vite
│   └── vite.config.ts            # Proxy /api → :8080
└── reporte_tecnico/              # Este reporte
    ├── figuras/                  # Gráficas generadas
    └── scripts/                  # Scripts Python para gráficas
```

---

*Reporte generado para el curso de Cómputo Paralelo, Ingeniería en Inteligencia Artificial.*
