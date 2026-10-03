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

p = np.array([1, 2, 4, 8, 16, 32, 64])

s_gustafson_omp = 1 + (p - 1) * f_omp
s_gustafson_cuda = 1 + (p - 1) * f_cuda
s_ideal = p

fig, ax = plt.subplots(figsize=(12, 7))

ax.plot(p, s_ideal, '--', color='gray', linewidth=1.5, label='Speedup ideal (lineal)', alpha=0.6)
ax.plot(p, s_gustafson_omp, 'o-', color='#5CB85C', linewidth=2.5, markersize=8,
        label=f'Gustafson OpenMP (f={f_omp})')
ax.plot(p, s_gustafson_cuda, 's-', color='#F0AD4E', linewidth=2.5, markersize=8,
        label=f'Gustafson CUDA (f={f_cuda})')

for i, pi in enumerate(p):
    ax.annotate(f'{s_gustafson_omp[i]:.1f}\u00d7', xy=(pi, s_gustafson_omp[i]),
                xytext=(0, -15), textcoords='offset points', fontsize=9,
                color='#5CB85C', ha='center', fontweight='bold')
    if pi <= 32:
        ax.annotate(f'{s_gustafson_cuda[i]:.1f}\u00d7', xy=(pi, s_gustafson_cuda[i]),
                    xytext=(0, 10), textcoords='offset points', fontsize=9,
                    color='#F0AD4E', ha='center', fontweight='bold')

ax.axvline(x=8, color='#5CB85C', linestyle=':', alpha=0.4)
ax.annotate('8 hilos\nOpenMP', xy=(8, 0), xytext=(8, ax.get_ylim()[0] if ax.get_ylim()[0] > 0 else -2),
            fontsize=9, color='#5CB85C', ha='center', va='bottom')

ax.set_xlabel('N\u00famero de procesadores (p)', fontsize=13, fontfamily='Calibri')
ax.set_ylabel('Speedup escalado (S_gs)', fontsize=13, fontfamily='Calibri')
ax.set_title('Ley de Gustafson - Speedup Escalado', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax.legend(fontsize=11, loc='upper left')
ax.grid(True, alpha=0.3, linestyle='--')
ax.set_axisbelow(True)
ax.set_xticks(p)

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura_gustafson.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)