"""
gráficas_isoeficiencia.py
Genera curvas de isoeficiencia para el análisis de escalamiento del solver Tetris.

Uso:
    python graficas_isoeficiencia.py

Genera:
    - figuras/figura4_strong_scaling.png
    - figuras/figura5_isoeficiencia.png
"""

import numpy as np
import matplotlib.pyplot as plt
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.dirname(SCRIPT_DIR)
FIG_DIR = os.path.join(REPORT_DIR, "figuras")
os.makedirs(FIG_DIR, exist_ok=True)


def amdahl_speedup(f, p):
    """Speedup teorico segun ley de Amdahl con fraccion paralelizable f."""
    return 1.0 / ((1 - f) + f / p)


def karp_flatt(f_exp, p):
    """Metrica de Karp-Flatt: fraccion serial experimental."""
    if p <= 1:
        return 0.0
    return (1.0 / amdahl_speedup(1 - f_exp, p) - 1.0 / p) / (1 - 1.0 / p)


# ---------------------------------------------------------------------------
# Figura 4: Strong Scaling - Tiempo vs Nucleos
# ---------------------------------------------------------------------------
def plot_strong_scaling():
    p_values = np.array([1, 2, 4, 8])
    T_seq = 500  # ms, N=3

    # Tiempos medidos (de 07_mediciones_empiricas.md)
    T_measured = np.array([500, 305, 205, 152])

    # Tiempos ideales (escalado perfecto)
    T_ideal = T_seq / p_values

    # Tiempos Amdahl (f=0.80)
    f_omp = 0.80
    T_amdahl = T_seq / amdahl_speedup(f_omp, p_values)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Subplot 1: Tiempo
    ax1.plot(p_values, T_measured, 'ro-', label='Medido', markersize=8)
    ax1.plot(p_values, T_amdahl, 'b^--', label=f'Amdahl (f={f_omp})', markersize=7)
    ax1.plot(p_values, T_ideal, 'gs:', label='Ideal', markersize=7)
    ax1.set_xlabel('Numero de hilos (p)')
    ax1.set_ylabel('Tiempo por decision (ms)')
    ax1.set_title('Strong Scaling: N=3 fijo, tiempo vs hilos')
    ax1.set_xticks(p_values)
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Subplot 2: Eficiencia
    S_measured = T_seq / T_measured
    S_amdahl = amdahl_speedup(f_omp, p_values)
    S_ideal = p_values.astype(float)

    E_measured = S_measured / p_values
    E_amdahl = S_amdahl / p_values
    E_ideal = S_ideal / p_values

    ax2.plot(p_values, E_measured, 'ro-', label='Medido', markersize=8)
    ax2.plot(p_values, E_amdahl, 'b^--', label=f'Amdahl (f={f_omp})', markersize=7)
    ax2.plot(p_values, E_ideal, 'gs:', label='Ideal', markersize=7)
    ax2.axhline(y=0.8, color='gray', linestyle='--', alpha=0.5, label='E=0.80')
    ax2.set_xlabel('Numero de hilos (p)')
    ax2.set_ylabel('Eficiencia E = S/p')
    ax2.set_title('Eficiencia de Strong Scaling')
    ax2.set_xticks(p_values)
    ax2.set_ylim(0, 1.1)
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, "figura4_strong_scaling.png"), dpi=150)
    plt.close()


# ---------------------------------------------------------------------------
# Figura 5: Isoeficiencia - N vs p para E = 80%
# ---------------------------------------------------------------------------
def plot_isoeficiency():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Subplot 1: E(N, p) para OpenMP
    p_values = np.array([1, 2, 4, 8, 16, 32, 64])

    # Tiempo secuencial por N
    T_seq_dict = {0: 0.01, 1: 0.5, 2: 15, 3: 500, 4: 15000, 5: 600000}

    N_values = np.array([1, 2, 3, 4, 5])
    f_omp = 0.80

    for N in N_values:
        if N not in T_seq_dict:
            continue
        T_seq = T_seq_dict[N]
        efficiencies = []
        for p in p_values:
            S = amdahl_speedup(f_omp, p)
            E = S / p
            efficiencies.append(E)
        ax1.plot(p_values, efficiencies, 'o-', label=f'N={N}')

    ax1.axhline(y=0.8, color='gray', linestyle='--', alpha=0.5, label='E=0.80')
    ax1.set_xlabel('Numero de hilos (p)')
    ax1.set_ylabel('Eficiencia E = S/p')
    ax1.set_title('Eficiencia OpenMP (Amdahl f=0.80)')
    ax1.set_xscale('log', base=2)
    ax1.set_ylim(0, 1.1)
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Subplot 2: Curva de isoeficiencia E=0.80
    # Para cada N, calcular el p maximo donde E >= 0.80
    f = 0.80
    E_target = 0.80

    # E = 1 / (p*(1-f) + f) >= E_target
    # p <= (1/E_target - f) / (1-f)
    # Pero queremos E = S/p = 1/(p*(1-f) + f) >= E_target
    # => p*(1-f) + f <= 1/E_target
    # => p <= (1/E_target - f) / (1-f)

    p_max = (1 / E_target - f) / (1 - f)

    N_isoeff = [1, 2, 3, 4, 5]
    p_isoeff = []
    for N in N_isoeff:
        if N not in T_seq_dict:
            continue
        T_seq = T_seq_dict[N]
        S_needed = p_values * E_target
        T_parallel_needed = T_seq / S_needed
        # E = f en Amdahl simple. Para isoeficiencia real necesitamos
        # p tal que E >= E_target con overhead real
        p_isoeff.append(min(p_max, 64))

    # Graficar la relacion N vs p para E = 0.80
    p_range = np.linspace(1, 20, 100)
    N_required = np.log(p_range * (1 - f) * (1 / E_target - 1) + 1) / np.log(40) - 1

    ax2.plot(p_range, N_required, 'r-', linewidth=2, label='N requerido')
    ax2.axhline(y=3, color='blue', linestyle='--', alpha=0.5, label='N=3 (practico)')
    ax2.axhline(y=4, color='green', linestyle='--', alpha=0.5, label='N=4 (limite GPU)')
    ax2.set_xlabel('Numero de hilos (p)')
    ax2.set_ylabel('N (look-ahead)')
    ax2.set_title('Isoeficiencia: N requerido para E=80% (OpenMP)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(1, 6)

    plt.tight_layout()
    plt.savefig(os.path.join(FIG_DIR, "figura5_isoeficiencia.png"), dpi=150)
    plt.close()


if __name__ == "__main__":
    print("Generando figura4_strong_scaling.png ...")
    plot_strong_scaling()
    print("Generando figura5_isoeficiencia.png ...")
    plot_isoeficiency()
    print(f"Figuras guardadas en {FIG_DIR}")