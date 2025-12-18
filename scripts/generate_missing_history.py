import math
import os
import random

def write_ply(filename, points, colors, edges):
    with open(filename, 'w') as f:
        f.write("ply\n")
        f.write("format ascii 1.0\n")
        f.write(f"element vertex {len(points)}\n")
        f.write("property float x\n")
        f.write("property float y\n")
        f.write("property float z\n")
        f.write("property uchar red\n")
        f.write("property uchar green\n")
        f.write("property uchar blue\n")
        f.write(f"element edge {len(edges)}\n")
        f.write("property int vertex1\n")
        f.write("property int vertex2\n")
        f.write("end_header\n")
        
        for p, c in zip(points, colors):
            f.write(f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f} {c[0]} {c[1]} {c[2]}\n")
            
        for e in edges:
            f.write(f"{e[0]} {e[1]}\n")
            
    print(f"Generated {filename}")

def generate_mlp():
    # 3 Layers: Input(4), Hidden(5), Output(3)
    layers = [4, 5, 3]
    points = []
    colors = []
    edges = []
    
    offset = 0
    layer_offsets = []
    
    for l_idx, count in enumerate(layers):
        layer_offsets.append(offset)
        for i in range(count):
            # Hexagonal/Circle layout for each layer
            angle = (i / count) * 2 * math.pi
            r = 2.0
            x = r * math.cos(angle)
            y = r * math.sin(angle)
            z = l_idx * 4.0 # Height
            
            points.append((x, z, y))
            colors.append((255, 100 + l_idx * 50, 0))
            
        offset += count

    # Fully connect layers
    for l_idx in range(len(layers) - 1):
        start_current = layer_offsets[l_idx]
        count_current = layers[l_idx]
        
        start_next = layer_offsets[l_idx+1]
        count_next = layers[l_idx+1]
        
        for i in range(count_current):
            for j in range(count_next):
                edges.append((start_current + i, start_next + j))
                
    write_ply('mlp_structure.ply', points, colors, edges)

def generate_ai_winter():
    # Sparse, disconnected, random points
    points = []
    colors = []
    edges = []
    
    # "The Void" - 50 random points
    for i in range(50):
        x = (random.random() - 0.5) * 10
        y = (random.random() - 0.5) * 10
        z = (random.random() - 0.5) * 10
        
        points.append((x, z, y))
        colors.append((100, 100, 255))
        
        # Very few edges to represent "broken" research
        if i > 0 and random.random() > 0.9:
            edges.append((i-1, i))
            
    write_ply('ai_winter_structure.ply', points, colors, edges)

def generate_lstm():
    # LSTM Cell Visualization
    points = []
    colors = []
    edges = []
    
    # 1. Memory Cell (Central Axis) - Green
    for i in range(10):
        points.append((0, i * 1.5, 0))
        colors.append((0, 255, 100))
        if i > 0: edges.append((i-1, i))
        
        idx = i
        r_loop = 0.5
        for k in range(3):
            angle = (k/3)*2*math.pi
            lx = r_loop * math.cos(angle)
            lz = r_loop * math.sin(angle)
            ly = i * 1.5
            p_loop_idx = len(points)
            points.append((lx, ly, lz))
            colors.append((0, 255, 200))
            edges.append((idx, p_loop_idx))
            
    # 2. The Gates (Input, Forget, Output) - Spirals
    gates = ['Input', 'Forget', 'Output']
    gate_colors = [(255, 255, 0), (255, 0, 0), (0, 100, 255)] # Yellow, Red, Blue
    
    base_idx = len(points)
    
    for g_idx, gate in enumerate(gates):
        for i in range(20):
            t = i / 3.0
            angle = t * 2 + (g_idx * 2 * math.pi / 3)
            r = 3.0
            x = r * math.cos(angle)
            z = r * math.sin(angle)
            y = i * 0.8
            
            points.append((x, y, z))
            colors.append(gate_colors[g_idx])
            
            curr_idx = base_idx + (g_idx * 20) + i
            if i > 0:
                edges.append((curr_idx - 1, curr_idx))
            if i % 2 == 0:
                core_idx = min(int(i / 2), 9)
                edges.append((curr_idx, core_idx))

    write_ply('lstm_structure.ply', points, colors, edges)

def generate_gan():
    # GAN Visualization: Generator vs Discriminator
    points = []
    colors = []
    edges = []
    
    # 1. Generator (Expanding, Cyan)
    gen_start_idx = 0
    for i in range(20):
        radius = 0.2 + i * 0.3
        y = i * 0.8
        count = 3 + int(i/2)
        for j in range(count):
            angle = (j/count) * 2 * math.pi
            x = radius * math.cos(angle) - 6.0
            z = radius * math.sin(angle)
            
            points.append((x, y, z))
            colors.append((0, 255, 255))
            
            curr = len(points) - 1
            if j > 0: edges.append((curr-1, curr))
            if j == count-1: edges.append((curr, curr-count+1))
            if i > 0:
                prev_layer_start = curr - count - (3 + int((i-1)/2))
                edges.append((curr, prev_layer_start + j % (3+int((i-1)/2))))

    # 2. Discriminator (Converging, Pink)
    disc_start_idx = len(points)
    for i in range(20):
        radius = 5.0 - (i * 0.25)
        if radius < 0.1: radius = 0.1
        y = i * 0.8
        count = 10 - int(i/2.5)
        if count < 1: count = 1
        
        for j in range(count):
            angle = (j/count) * 2 * math.pi
            x = radius * math.cos(angle) + 6.0
            z = radius * math.sin(angle)
            
            points.append((x, y, z))
            colors.append((255, 0, 100))
            
            curr = len(points) - 1
            if count > 1:
                if j > 0: edges.append((curr-1, curr))
                if j == count-1: edges.append((curr, curr-count+1))
            if i > 0:
                 edges.append((curr, curr - count)) # Simple vertical connection

    # 3. Adversarial Connections
    for i in range(5):
        y = 5.0 + i * 2.0
        p1 = len(points)
        p2 = len(points) + 1
        points.append((-2.0, y, 0))
        points.append((2.0, y, 0))
        colors.append((255, 255, 255))
        colors.append((255, 0, 0))
        edges.append((p1, p2))

    write_ply('gan_structure.ply', points, colors, edges)

if __name__ == "__main__":
    generate_mlp()
    generate_ai_winter()
    generate_lstm()
    generate_gan()
