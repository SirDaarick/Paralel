# Entregables del Proyecto Integrador - Cómputo Paralelo

Basado en las **Especificaciones v3** y el **Reporte Ejemplo**, este documento resume qué se debe entregar.

---

## 1. Problema a resolver

**Requisitos del problema:**
- Computacionalmente intensivo
- Paralelizable por **datos** o por **tareas**
- Área afín a **Inteligencia Artificial** (ejemplos: multiplicación de matrices para redes neuronales, convoluciones 2D, optimización PSO, k-means alta dimensión, simulación epidemias con autómatas celulares)
- **Mínimo 3 enfoques:** secuencial (baseline), memoria compartida (OpenMP/pthreads), paso de mensajes/aceleradores (MPI, CUDA, OpenCL, Python multiprocessing+NumPy)
- Documentar diseño con **Método de Foster**

---

## 2. Estructura del Reporte Final

| Sección | Contenido |
|---------|-----------|
| **Portada** | Título, estudiante, fecha, materia |
| **Resumen** | Síntesis ejecutiva (problema, enfoques, resultados clave) |
| **Introducción** | Contexto, motivación, objetivos |
| **Descripción formal del problema** | Modelo matemático, variables, restricciones |
| **Análisis de complejidad** | Operaciones escalares en función de *n* (no FLOPS) |
| **Diseño paralelo (Foster)** | Particionamiento, comunicación, aglomeración, mapeo |
| **Casos de estudio teóricos** | Caso 1: hardware conocido → tiempos; Caso 2: plazo fijo → hardware |
| **Mediciones experimentales** | Tablas comparativas, speedup real vs teórico, métrica Karp-Flatt |
| **Análisis de escalabilidad** | Strong scaling, weak scaling, función de isoeficiencia |
| **Depuración y overhead** | Herramientas usadas (VTune, Nsight, perf, Valgrind), hallazgos |
| **Evidencias por unidad temática** | 5 unidades (ver abajo) |
| **Conclusiones y recomendaciones** | |
| **Referencias** | |
| **Código fuente** | Anexado |

---

## 3. Análisis de Complejidad (Sección obligatoria)

- Contar **operaciones escalares** (sumas, multiplicaciones) en función del tamaño de entrada *n*
- Ejemplo matriz N×N: `2N³ - N²` operaciones
- **No confundir** con FLOPS (ops/segundo)

---

## 4. Casos de Estudio Teóricos

### Caso 1: Hardware conocido → Estimación de tiempos
- Especificar CPU/GPU reales
- Calcular T_seq, T_OpenMP, T_CUDA con overheads realistas
- Incluir gráfico de barras comparativo

### Caso 2: Plazo fijo → Hardware necesario
- Definir restricción temporal (ej. ≤ 0.5s, o reentrenamiento nocturno < 30 min)
- Calcular rendimiento requerido (ops/s)
- Proponer hardware mínimo con justificación

---

## 5. Mediciones Empíricas (Mínimo 3 APIs)

**Tabla requerida:**
| Tamaño (n) | Secuencial (ms) | OpenMP (ms) | CUDA (ms) | Speedup real | Speedup teórico (Amdahl) |
|------------|-----------------|-------------|-----------|--------------|--------------------------|

**Análisis obligatorio:**
- Diferencias speedup real vs teórico
- **Métrica de Karp-Flatt** para fracción serial experimental
- Gráfica: speedup ideal (Amdahl) vs medido vs núcleos

---

## 6. Análisis de Escalamiento

### Strong Scaling
- Tamaño fijo, variar núcleos
- Tabla/gráfico: tiempo vs núcleos, eficiencia

### Weak Scaling
- Duplicar núcleos, duplicar tamaño
- Mantener eficiencia >80%

### Función de Isoeficiencia
- Determinar experimentalmente cómo crece *N* vs *p* para eficiencia constante (ej. 80%)
- Forma: `N ∝ p^α` (encontrar α)
- Incluir script Python (matplotlib) que genera la curva

---

## 7. Depuración y Overhead

**Herramientas a usar (al menos 2):**
- Intel VTune / gprof / perf
- NVIDIA Nsight Systems
- Valgrind (helgrind/drd)

**Tabla de hallazgos:**
| Función/Región | Tiempo total (ms) | % overhead | Causa identificada |
|----------------|-------------------|------------|---------------------|

**Gráfico:** Flame graph mostrando hotspots

---

## 8. Evidencias de Aprendizaje por Unidad Temática (OBLIGATORIO)

| Unidad | Tema | Evidencia requerida en el reporte |
|--------|------|-----------------------------------|
| **I** | Arquitecturas paralelas | Diagrama taxonomía Flynn + justificación modelo memoria |
| **II** | Diseño paralelo (Foster) | Aplicación completa: speedup, eficiencia, Amdahl, Gustafson, Karp-Flatt |
| **III** | Memoria compartida | OpenMP/pthreads + análisis coherencia caché, false sharing |
| **IV** | Sistemas distribuidos | MPI + análisis overhead red, topología interconexión |
| **V** | Aceleradores / Flujo datos | CUDA/OpenCL optimizado (memoria compartida, tiling, streams asíncronos) |

---

## 9. Formato y Entrega

- **Documento:** PDF o HTML profesional (ver ejemplo)
- **Idioma:** Español
- **Código:** Fuente completo anexado (repositorio o carpeta)
- **Gráficas:** Generadas con scripts (incluir código Python/Matplotlib)
- **Imágenes:** Placeholders con prompts para IA (ver archivos HTML)

---

## 10. Checklist de Verificación Final

- [ ] Problema de IA, paralelizable, 3+ enfoques implementados
- [ ] Método Foster documentado completo
- [ ] Análisis complejidad con fórmulas (operaciones escalares)
- [ ] Caso 1: hardware → tiempos (con gráfico)
- [ ] Caso 2: plazo → hardware (con gráfico)
- [ ] Mediciones 3+ APIs con tabla comparativa
- [ ] Speedup real vs Amdahl + Karp-Flatt
- [ ] Strong scaling + weak scaling + isoeficiencia (script incluido)
- [ ] Depuración: 2+ herramientas, tabla overhead, flame graph
- [ ] 5 evidencias unidad temática explícitas
- [ ] Código fuente anexado y compilable
- [ ] Reporte en español, formato profesional

---

## 11. Referencia Rápida: Diferencias Especificaciones vs Ejemplo

| Aspecto | Especificaciones (v3) | Reporte Ejemplo |
|---------|----------------------|-----------------|
| **Problema** | Libre elección (IA) | Factorización matricial SVD (streaming) |
| **APIs mínimas** | OpenMP, MPI, CUDA/OpenCL | OpenMP, CUDA (simple + tiling) |
| **Hardware ejemplo** | Ryzen 7 5800X + RTX 3060 | Ryzen 9 7950X + RTX 4090 |
| **Tamaño ejemplo** | N=2048, 4096 | 500k×50k×100 (reducido 10k×5k×50 para pruebas) |
| **Unidades temáticas** | 5 (I-V) | 5 evidencias explícitas |
| **Isoeficiencia** | Requerida + script Python | `N ∝ p^1.15` determinado experimentalmente |

---

## 12. Próximos Pasos Recomendados

1. **Definir tu problema** (diferente al ejemplo si es posible)
2. **Implementar versión secuencial** baseline + tests
3. **Aplicar Método Foster** y documentar
4. **Implementar OpenMP** (memoria compartida)
5. **Implementar CUDA** (acelerador) - *si no hay GPU, usar MPI o Python multiprocessing*
6. **Ejecutar mediciones** en hardware real
7. **Generar gráficas** con scripts Python (automatizar)
8. **Redactar reporte** siguiendo estructura arriba
9. **Verificar checklist** completo antes de entregar

---

*Documento generado a partir de: `Especificaciones Proyecto Integrador - Cómputo Paralelo (v3).html` y `Reporte Ejemplo - Optimización Paralela de Sistema de Recomendación.html`*