import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURAS_DIR = os.path.join(SCRIPT_DIR, 'figuras')
os.makedirs(FIGURAS_DIR, exist_ok=True)

p_vals = np.array([2, 4, 8])
S_vals = np.array([1.9, 3.6, 3.3])

f_exp = (1.0 / S_vals - 1.0 / p_vals) / (1.0 - 1.0 / p_vals)

f_teorico = 0.20

fig, ax = plt.subplots(figsize=(10, 6))

colors = ['#4A90D9', '#5CB85C', '#D9534F']
bars = ax.bar([str(p) for p in p_vals], f_exp, color=colors, edgecolor='white',
              linewidth=0.8, width=0.5, zorder=3)

for bar, val, p, s in zip(bars, f_exp, p_vals, S_vals):
    ax.annotate(f'e = {val:.3f}\n(S={s}\u00d7)',
                xy=(bar.get_x() + bar.get_width() / 2, val),
                xytext=(0, 10), textcoords='offset points',
                ha='center', va='bottom', fontsize=10, fontweight='bold', fontfamily='Calibri')

ax.axhline(y=f_teorico, color='#F0AD4E', linestyle='--', linewidth=2, alpha=0.8,
           label=f'Fracci\u00f3n serial te\u00f3rica (f = {f_teorico})')

ax.annotate(f'f te\u00f3rico = {f_teorico}',
             xy=(2.5, f_teorico), fontsize=11, color='#F0AD4E', fontweight='bold',
             va='bottom')

ax.set_xlabel('N\u00famero de hilos (p)', fontsize=13, fontfamily='Calibri')
ax.set_ylabel('Fracci\u00f3n serial experimental (f_exp)', fontsize=13, fontfamily='Calibri')
ax.set_title('M\u00e9trica de Karp-Flatt - Fracci\u00f3n Serial Experimental', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax.legend(fontsize=11)
ax.grid(True, axis='y', alpha=0.3, linestyle='--')
ax.set_axisbelow(True)
ax.set_ylim(0, max(f_exp) * 1.4)

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura_karp_flatt.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)