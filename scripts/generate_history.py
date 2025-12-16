
import numpy as np
from plyfile import PlyData, PlyElement
import torch
import torch.nn as nn
import os

# --- 1. LeNet-5 (1998) ---
def generate_lenet():
    # Synthetic representation: 2 Conv layers, 3 FC layers
    # Layers: 
    # 0: Input (32x32)
    # 1: Conv1 (6x28x28) -> represented as 6 small clusters
    # 2: Conv2 (16x10x10) -> 16 clusters
    # 3: FC1 (120) -> Dense line
    # 4: FC2 (84) -> Dense line
    # 5: Output (10) -> Small points
    
    vertices = []
    
    # Conv1: 6 filters, arranged in a hexagon
    for i in range(6):
        angle = (i / 6) * 2 * np.pi
        x = np.cos(angle) * 2.0
        y = np.sin(angle) * 2.0
        z = 0.0
        # Add a small cluster for each filter
        for _ in range(20): 
            vertices.append(((x+np.random.normal(0,0.2), y+np.random.normal(0,0.2), z+np.random.normal(0,0.1)), 255, 200, 100)) # Gold

    # Conv2: 16 filters, larger ring
    for i in range(16):
        angle = (i / 16) * 2 * np.pi
        x = np.cos(angle) * 4.0
        y = np.sin(angle) * 4.0
        z = 2.0
        for _ in range(15):
             vertices.append(((x+np.random.normal(0,0.3), y+np.random.normal(0,0.3), z+np.random.normal(0,0.2)), 100, 255, 200)) # Teal

    # FC1: 120 nodes, dense cylinder
    for i in range(120):
        angle = np.random.rand() * 2 * np.pi
        r = np.sqrt(np.random.rand()) * 1.5
        x = r * np.cos(angle)
        y = r * np.sin(angle)
        z = 4.0
        vertices.append(((x, y, z), 255, 100, 100)) # Red

    # FC2: 84 nodes
    for i in range(84):
        angle = np.random.rand() * 2 * np.pi
        r = np.sqrt(np.random.rand()) * 1.0
        x = r * np.cos(angle)
        y = r * np.sin(angle)
        z = 5.0
        vertices.append(((x, y, z), 200, 100, 255)) # Purple

    # Output: 10 nodes
    for i in range(10):
        x = (i - 4.5) * 0.5
        y = 0
        z = 6.0
        vertices.append(((x, y, z), 255, 255, 255)) # White

    save_ply("lenet.ply", vertices)


# --- 2. DeepSeek MoE (2025) ---
def generate_moe():
    # Mixture of Experts: Sparse activation path
    # A central trunk that splits into specific "expert" clusters
    vertices = []
    
    num_layers = 12
    num_experts = 8
    
    for l in range(num_layers):
        z = l * 1.0
        
        # Router (Central Hub)
        for _ in range(50):
            vertices.append(((np.random.normal(0,0.5), np.random.normal(0,0.5), z), 0, 243, 255)) # Cyan
            
        # Experts (Satellites)
        # Only activate 2 random experts per layer strongly (Routing)
        active_experts = np.random.choice(num_experts, 2, replace=False)
        
        for e in range(num_experts):
            angle = (e / num_experts) * 2 * np.pi
            ex = np.cos(angle) * 3.0
            ey = np.sin(angle) * 3.0
            
            is_active = e in active_experts
            color = (255, 50, 50) if is_active else (255, 255, 255) # Red active, Grey inactive
            count = 40 if is_active else 10 # Sparse
            
            # Draw Expert Cluster
            for _ in range(count):
                vx = ex + np.random.normal(0, 0.3)
                vy = ey + np.random.normal(0, 0.3)
                vz = z + np.random.normal(0, 0.1)
                
                # If inactive, make very spread out/ghostly
                if not is_active:
                    vertices.append(((vx, vy, vz), 50, 50, 50))
                else:
                    vertices.append(((vx, vy, vz), 255, 0, 100)) # Neon Pink Activity

            # Connect Router to Active Expert (Stream)
            if is_active:
                for t in np.linspace(0, 1, 10):
                    lx = t * ex
                    ly = t * ey
                    lz = z
                    vertices.append(((lx+np.random.normal(0,0.05), ly+np.random.normal(0,0.05), lz), 255, 200, 0)) # Gold link

    save_ply("moe_2025.ply", vertices)

def save_ply(filename, vertices):
    vertex = np.array([(*v, *c) for v, c in vertices],
                      dtype=[('x', 'f4'), ('y', 'f4'), ('z', 'f4'),
                             ('red', 'u1'), ('green', 'u1'), ('blue', 'u1')])
    el = PlyElement.describe(vertex, 'vertex')
    PlyData([el], text=True).write(filename)
    print(f"Saved {filename}")

if __name__ == "__main__":
    generate_lenet()
    generate_moe()
