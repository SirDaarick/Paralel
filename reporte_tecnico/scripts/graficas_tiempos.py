import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURAS_DIR = os.path.join(SCRIPT_DIR, 'figuras')
os.makedirs(FIGURAS_DIR, exist_ok=True)

N_LABELS = ['N=0', 'N=1', 'N=2', 'N=3', 'N=4']
secuencial = [0.01, 0.5, 15, 500, 15000]
openmp = [0.003, 0.15, 4.5, 150, 4500]
cuda = [0.10, 0.20, 1.0, 5.0, 150]

x = np.arange(len(N_LABELS))
width = 0.25

fig, ax = plt.subplots(figsize=(12, 7))

bars_seq = ax.bar(x - width, secuencial, width, label='Secuencial', color='#4A90D9', edgecolor='white', linewidth=0.5)
bars_omp = ax.bar(x, openmp, width, label='OpenMP (8T)', color='#5CB85C', edgecolor='white', linewidth=0.5)
bars_cuda = ax.bar(x + width, cuda, width, label='CUDA (GTX 1650)', color='#F0AD4E', edgecolor='white', linewidth=0.5)

ax.set_yscale('log')
ax.set_xlabel('Nivel de look-ahead', fontsize=13, fontfamily='Calibri')
ax.set_ylabel('Tiempo por decisión (ms)', fontsize=13, fontfamily='Calibri')
ax.set_title('Tiempo de ejecución por decisión según nivel de look-ahead', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax.set_xticks(x)
ax.set_xticklabels(N_LABELS, fontsize=12)
ax.legend(fontsize=12, loc='upper left')

ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.set_axisbelow(True)

fmt = lambda v: f'{v:.0f} ms' if v >= 1 else (f'{v:.1f} ms' if v >= 0.1 else f'{v*1000:.0f} \u00b5s')

for bars in [bars_seq, bars_omp, bars_cuda]:
    for bar in bars:
        h = bar.get_height()
        ax.annotate(fmt(h),
                    xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 5), textcoords='offset points',
                    ha='center', va='bottom', fontsize=8, fontfamily='Calibri')

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura1_tiempos.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)