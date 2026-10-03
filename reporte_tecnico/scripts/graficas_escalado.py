import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURAS_DIR = os.path.join(SCRIPT_DIR, 'figuras')
os.makedirs(FIGURAS_DIR, exist_ok=True)

hilos = np.array([1, 2, 4, 8])
tiempo_strong = np.array([500, 260, 140, 150])
eficiencia_strong = np.array([1.00, 0.96, 0.89, 0.42])

fig, ax1 = plt.subplots(figsize=(10, 6))

bars = ax1.bar(hilos - 0.15, tiempo_strong, width=0.3, color='#4A90D9', edgecolor='white',
               linewidth=0.5, label='Tiempo (ms)', zorder=3)
ax1.set_xlabel('N\u00famero de hilos', fontsize=13, fontfamily='Calibri')
ax1.set_ylabel('Tiempo (ms)', fontsize=13, fontfamily='Calibri', color='#4A90D9')
ax1.tick_params(axis='y', labelcolor='#4A90D9')

for bar, val in zip(bars, tiempo_strong):
    ax1.annotate(f'{val} ms',
                 xy=(bar.get_x() + bar.get_width() / 2, val),
                 xytext=(0, 5), textcoords='offset points',
                 ha='center', va='bottom', fontsize=9, color='#4A90D9', fontweight='bold')

ax2 = ax1.twinx()
ax2.plot(hilos + 0.15, eficiencia_strong * 100, 'o-', color='#D9534F', linewidth=2.5,
         markersize=8, label='Eficiencia (%)', zorder=4)
ax2.set_ylabel('Eficiencia (%)', fontsize=13, fontfamily='Calibri', color='#D9534F')
ax2.tick_params(axis='y', labelcolor='#D9534F')
ax2.set_ylim(0, 110)

for h, e in zip(hilos, eficiencia_strong):
    ax2.annotate(f'{e*100:.0f}%',
                 xy=(h, e * 100), xytext=(8, 5), textcoords='offset points',
                 fontsize=9, color='#D9534F', fontweight='bold')

lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper right', fontsize=11)

ax1.set_title('Strong Scaling (N=3 fijo)', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax1.set_xticks(hilos)
ax1.grid(True, alpha=0.3, linestyle='--')
ax1.set_axisbelow(True)

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura4_strong_scaling.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)

tiempo_weak = np.array([500, 520, 560, 600])

fig, ax = plt.subplots(figsize=(10, 6))

ax.plot(hilos, tiempo_weak, 'o-', color='#5CB85C', linewidth=2.5, markersize=10,
        label='Tiempo medido', zorder=4)
ax.axhline(y=500, color='gray', linestyle='--', linewidth=1.5, alpha=0.6, label='Referencia ideal (500 ms)')

for h, t in zip(hilos, tiempo_weak):
    ax.annotate(f'{t} ms', xy=(h, t), xytext=(8, 8), textcoords='offset points',
                fontsize=10, fontweight='bold', color='#5CB85C')

ax.fill_between(hilos, 500, tiempo_weak, alpha=0.15, color='#D9534F')

ax.set_xlabel('N\u00famero de hilos', fontsize=13, fontfamily='Calibri')
ax.set_ylabel('Tiempo (ms)', fontsize=13, fontfamily='Calibri')
ax.set_title('Weak Scaling (trabajo por hilo constante)', fontsize=15, fontweight='bold', fontfamily='Calibri')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3, linestyle='--')
ax.set_axisbelow(True)
ax.set_xticks(hilos)
ax.set_ylim(450, 650)

plt.tight_layout()
out_path = os.path.join(FIGURAS_DIR, 'figura_weak_scaling.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)