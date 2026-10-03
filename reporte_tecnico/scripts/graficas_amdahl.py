import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURAS_DIR = os.path.join(SCRIPT_DIR, 'figuras')
os.makedirs(FIGURAS_DIR, exist_ok=True)

f_omp = 0.80
f_cuda = 0.86

p_theory = np.linspace(1, 35, 500)
s_ideal = p_theory
s_amdahl_omp = 1.0 / ((1 - f_omp) + f_omp / p_theory)
s_amdahl_cuda = 1.0 / ((1 - f_cuda) + f_cuda / p_theory)

s_inf_omp = 1.0 / (1 - f_omp)
s_inf_cuda = 1.0 / (1 - f_cuda)

p_meas_omp = np.array([1, 2, 4, 8])
s_meas_omp = np.array([1.0, 1.9, 3.6, 3.3])

fig, ax = plt.subplots(figsize=(12, 7))

ax.plot(p_theory, s_ideal, '--', color='gray', linewidth=1.5, label='Speedup ideal (lineal)', alpha=0.6)
ax.plot(p_theory, s_amdahl_omp, '-', color='#5CB85C', linewidth=2, label=f'Amdahl te\u00f3rico OpenMP (f={f_omp})')
ax.plot(p_theory, s_amdahl_cuda, '-', color='#F0AD4E', linewidth=2, label=f'Amdahl te\u00f3rico CUDA (f={f_cuda})')

ax.axhline(y=s_inf_omp, color='#5CB85C', linestyle=':', linewidth=1, alpha=0.7)
ax.axhline(y=s_inf_cuda, color='#F0AD4E', linestyle=':', linewidth=1, alpha=0.7)

ax.annotate(f'S\u221e OpenMP = {s_inf_omp:.1f}\u00d7',
            xy=(32, s_inf_omp), fontsize=10, color='#5CB85C', fontweight='bold',
            va='bottom')
ax.annotate(f'S\u221e CUDA = {s_inf_cuda:.2f}\u00d7',
            xy=(32, s_inf_cuda), fontsize=10, color='#F0AD4E', fontweight='bold',
            va='bottom')

ax.scatter(p_meas_omp, s_meas_omp, color='#5CB85C', s=80, zorder=5, edgecolor='black', linewidth=0.8, label='Speedup medido OpenMP')
for px, sx in zip(p_meas_omp, s_meas_omp):
    ax.annotate(f'{sx:.1f}\u00d7', xy=(px, sx), xytext=(8, 8), textcoords='offset points',
                fontsize=10, color='#5CB85C', fontweight='bold')

ax.scatter([896], [7.2], color='#F0AD4E', s=100, zorder=5, edgecolor='black', linewidth=0.8, marker='D')
ax.annotate('CUDA medido\n7.2\u00d7 (896 cores)', xy=(896, 7.2), xytext=(-140, 15),
            textcoords='offset points', fontsize=10, color='#F0AD4E', fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='#F0AD4E', lw=1.5))

ax.set_xlabel('N\u00famero de procesadores / hilos', fontsize=13, fontfamily='Calibri')
ax.set_ylabel('Speedup', fontsize=13, fontfamily='Calibri')
ax.set_title('Ley de Amdahl - Speedup vs. N\u00famero de procesadores', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax.legend(fontsize=10, loc='upper left')
ax.grid(True, alpha=0.3, linestyle='--')
ax.set_axisbelow(True)
ax.set_xlim(0.8, 35)
ax.set_ylim(0, max(s_amdahl_cuda[-1], s_ideal[-1]) * 1.1)

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura3_amdahl.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)