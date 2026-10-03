import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIGURAS_DIR = os.path.join(SCRIPT_DIR, 'figuras')
os.makedirs(FIGURAS_DIR, exist_ok=True)

fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle('Taxonom\u00eda de Flynn aplicada al proyecto', fontsize=18, fontweight='bold', fontfamily='Calibri', y=0.97)

categories = [
    {
        'title': 'SISD',
        'subtitle': 'Single Instruction\nSingle Data',
        'desc': 'Un procesador ejecuta\nuna instrucci\u00f3n sobre\nun flujo de datos',
        'example': 'Solver secuencial\n(1 hilo CPU)',
        'color': '#4A90D9',
        'procs': 1, 'streams': 1,
        'proc_labels': ['P'], 'data_labels': ['D']
    },
    {
        'title': 'SIMD',
        'subtitle': 'Single Instruction\nMultiple Data',
        'desc': 'Un procesador ejecuta\nuna instrucci\u00f3n sobre\nm\u00faltiples datos',
        'example': 'CUDA (SIMT)\n896 cores GPU',
        'color': '#F0AD4E',
        'procs': 1, 'streams': 4,
        'proc_labels': ['P'], 'data_labels': ['D1', 'D2', 'D3', 'D4']
    },
    {
        'title': 'MISD',
        'subtitle': 'Multiple Instruction\nSingle Data',
        'desc': 'M\u00faltiples procesadores\nejecutan distintas\ninstrucciones sobre\nun flujo de datos',
        'example': 'No aplicado\n(redundancia)',
        'color': '#D9534F',
        'procs': 4, 'streams': 1,
        'proc_labels': ['P1', 'P2', 'P3', 'P4'], 'data_labels': ['D']
    },
    {
        'title': 'MIMD',
        'subtitle': 'Multiple Instruction\nMultiple Data',
        'desc': 'M\u00faltiples procesadores\nejecutan distintas\ninstrucciones sobre\ndistintos datos',
        'example': 'OpenMP / MPI\n8 hilos independientes',
        'color': '#5CB85C',
        'procs': 4, 'streams': 4,
        'proc_labels': ['P1', 'P2', 'P3', 'P4'], 'data_labels': ['D1', 'D2', 'D3', 'D4']
    }
]

for idx, cat in enumerate(categories):
    ax = axes[idx // 2][idx % 2]

    bg_color = cat['color'] + '15'
    ax.set_facecolor(bg_color)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)

    for spine in ax.spines.values():
        spine.set_color(cat['color'])
        spine.set_linewidth(3)

    ax.set_xticks([])
    ax.set_yticks([])

    ax.text(5, 9.2, cat['title'], ha='center', va='top',
            fontsize=22, fontweight='bold', fontfamily='Calibri', color=cat['color'])
    ax.text(5, 7.8, cat['subtitle'], ha='center', va='top',
            fontsize=9, fontfamily='Calibri', color='#555555', style='italic')

    ax.text(5, 5.8, cat['desc'], ha='center', va='top',
            fontsize=9, fontfamily='Calibri', color='#333333')

    n_procs = len(cat['proc_labels'])
    proc_x_start = 5 - (n_procs - 1) * 0.8
    for i, label in enumerate(cat['proc_labels']):
        px = proc_x_start + i * 1.6
        rect = mpatches.FancyBboxPatch((px - 0.5, 3.3), 1.0, 0.7,
                                         boxstyle="round,pad=0.1",
                                         facecolor=cat['color'], edgecolor='white',
                                         linewidth=1.5, alpha=0.85)
        ax.add_patch(rect)
        ax.text(px, 3.65, label, ha='center', va='center',
                fontsize=8, fontweight='bold', color='white', fontfamily='Calibri')

    n_data = len(cat['data_labels'])
    data_x_start = 5 - (n_data - 1) * 0.8
    for i, label in enumerate(cat['data_labels']):
        dx = data_x_start + i * 1.6
        rect = mpatches.FancyBboxPatch((dx - 0.45, 2.0), 0.9, 0.6,
                                         boxstyle="round,pad=0.1",
                                         facecolor='#F5F5F5', edgecolor=cat['color'],
                                         linewidth=1.5, alpha=0.9)
        ax.add_patch(rect)
        ax.text(dx, 2.3, label, ha='center', va='center',
                fontsize=7, color=cat['color'], fontweight='bold', fontfamily='Calibri')

    ax.text(5, 1.3, cat['example'], ha='center', va='center',
            fontsize=10, fontweight='bold', fontfamily='Calibri', color=cat['color'],
            bbox=dict(boxstyle='round,pad=0.4', facecolor='white', edgecolor=cat['color'],
                      linewidth=1.5, alpha=0.95))

plt.tight_layout(rect=[0, 0, 1, 0.94])
out_path = os.path.join(FIGURAS_DIR, 'figura6_flynn.png')
fig.savefig(out_path, dpi=150, bbox_inches='tight')
plt.close(fig)
print(out_path)