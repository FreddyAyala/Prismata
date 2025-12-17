import argparse
import sys
import numpy as np
from sklearn.decomposition import PCA
from plyfile import PlyData, PlyElement
from transformers import AutoModel

from lib.models import SimpleAlexNet, SimpleDeepSeekMOE, SimpleVGG16, SimplePerceptron, SimpleInception, SimpleGPT4, SimpleGemini3, SimpleWord2Vec, get_model_structure
from lib.extractors import extract_weights, get_activations
from lib.rendering import get_color

def extract_and_crystallize(model_name='bert-base-uncased', step=2, mode='layers', text="The future is vast and infinite", image_path=None):
    print(f"💎 Loading universal model: {model_name}...")
    try:
        if model_name == 'alexnet':
            model = SimpleAlexNet()
            print("   ⚠️  Using manually defined AlexNet (Untrained/Random Weights) as torchvision is unavailable.")
        elif model_name == 'deepseek':
            model = SimpleDeepSeekMOE()
            print("   ⚠️  Using manually defined DeepSeek-V3 MoE (Sparse Mock) to visualize MoE Structure without 600GB download.")
        elif model_name == 'vgg16':
            model = SimpleVGG16()
            print("   ⚠️  Using manually defined VGG-16 (Untrained).")
        elif model_name == 'perceptron':
            model = SimplePerceptron()
            print("   ⚠️  Using manually defined Perceptron (1958).")
        elif model_name == 'inception':
            model = SimpleInception()
            print("   ⚠️  Using manually defined Inception-v1/GoogLeNet (Mock).")
        elif model_name == 'gpt4':
            model = SimpleGPT4()
            print("   ⚠️  Using manually defined GPT-4 (Mock MoE).")
        elif model_name == 'gemini3':
            model = SimpleGemini3()
            print("   ⚠️  Using manually defined Gemini 3.0 (Mock Omni).")
        elif model_name == 'word2vec':
            model = SimpleWord2Vec()
            print("   ⚠️  Using manually defined Word2Vec (2013).")
        else:
            model = AutoModel.from_pretrained(model_name)
    except Exception as e:
        print(f"Error loading model '{model_name}': {e}")
        return

    # If doing MRI scan, get the thoughts first
    layer_activations = {}
    if mode == 'activation':
        layer_activations = get_activations(model, model_name, text, image_path)

    print(f"💎 Extracting layers and growing crystal lattice for {model_name} [Mode: {mode}]...")
    
    all_layer_data = []
    layers = get_model_structure(model)
    
    # 1. Collect all raw data
    for layer_idx, block in enumerate(layers):
        weights = extract_weights(block)
        if weights is not None:
            # We sample with 'step' to reduce density
            data_slice = weights[::step]
            all_layer_data.append(data_slice)
        else:
            print(f"Warning: Could not extract weights from layer {layer_idx} (Unknown architecture).")
            
    if not all_layer_data: 
        print("No data extracted. Is this model supported?")
        return

    # 2. PCA Strategy
    use_global_pca = False
    projected_matrix = None
    
    try:
        # Try Global PCA (Best for Transformers)
        full_matrix = np.vstack(all_layer_data)
        print(f"   ↳ Compressing {full_matrix.shape} dimensions (Global PCA)...")
        pca = PCA(n_components=2)
        projected_matrix = pca.fit_transform(full_matrix)
        
        # Normalize Global
        max_val = np.max(np.abs(projected_matrix))
        if max_val > 0: projected_matrix /= max_val
        use_global_pca = True
        
    except ValueError:
        # Fallback to Per-Layer PCA (Necessary for CNNs/ResNet where dims change)
        print("   ⚠️  Layer dimensions mismatch (likely CNN/ResNet). Switching to Per-Layer PCA mode...")
        use_global_pca = False

    points, colors, edges = [], [], []
    # Note: points_per_layer might vary in ResNet if not using global PCA.
    # If global PCA is used, all_layer_data[0].shape[0] is representative.
    # If not, current_points_count will be used per layer.
    if use_global_pca and all_layer_data:
        points_per_layer = all_layer_data[0].shape[0] 
    else:
        points_per_layer = 0 # Will be determined per layer

    total_layers = len(all_layer_data)
    
    print(f"   ↳ Constructing {mode.upper()} Lattice...")

    # 3. Build the Crystal
    global_point_offset = 0
    
    for layer_idx in range(total_layers):
        layer_weights = all_layer_data[layer_idx]
        current_points_count = layer_weights.shape[0]
        
        # Determine Projection
        if use_global_pca:
            # If global PCA was successful, all layers must have had the same number of features.
            # So points_per_layer is constant.
            start_idx = layer_idx * points_per_layer 
            end_idx = start_idx + current_points_count
            layer_projection = projected_matrix[start_idx:end_idx]
        else:
            # Per-Layer PCA
            pca = PCA(n_components=2)
            layer_projection = pca.fit_transform(layer_weights)
            # Normalize Local
            mx = np.max(np.abs(layer_projection))
            if mx > 0: layer_projection /= mx
            
        # Get activations for this layer if needed
        current_layer_acts = None
        if mode == 'activation':
            current_layer_acts = layer_activations.get(layer_idx, np.zeros(current_points_count)) # Fallback size might be wrong for ResNet
            if isinstance(current_layer_acts, (float, int, np.float32, np.float64)):
                 current_layer_acts = np.zeros(1) # dummy

        for i, (x, y) in enumerate(layer_projection):
            z = layer_idx * 0.15 
            points.append((x*1.5, z, y*1.5)) # Scale up slightly for visibility
            
            # COLOR LOGIC
            weight_magnitude = np.mean(np.abs(layer_weights[i]))
            
            original_neuron_idx = i * step
            
            act_val = 0
            if mode == 'activation' and current_layer_acts is not None:
                if original_neuron_idx < current_layer_acts.shape[0]:
                    act_val = current_layer_acts[original_neuron_idx]

            r, g, b = get_color(mode, layer_idx, total_layers, original_neuron_idx, weight_magnitude, act_val)
            colors.append((r, g, b))
            
            # Edge Logic
            current_node_idx = global_point_offset + i
            
            # Horizontal Ring
            if i > 0:
                 edges.append((current_node_idx - 1, current_node_idx))
            
            # Vertical/Diagonal Connections (Only if previous layer exists)
            # For ResNet, layer sizes change, so 1:1 connection is impossible.
            # We connect to the "relative" position in the previous layer.
            if layer_idx > 0:
                prev_layer_count = all_layer_data[layer_idx-1].shape[0]
                prev_layer_start = global_point_offset - prev_layer_count
                
                # Map current index 'i' (0..N) to previous index 'j' (0..M)
                ratio = i / current_points_count
                prev_idx_approx = int(ratio * prev_layer_count)
                prev_idx_approx = min(prev_idx_approx, prev_layer_count - 1) # Clamp
                prev_node_idx = prev_layer_start + prev_idx_approx
                
                edges.append((prev_node_idx, current_node_idx))
                # Diagonal skin
                if prev_idx_approx > 0:
                    edges.append((prev_layer_start + prev_idx_approx - 1, current_node_idx))
                if prev_idx_approx < prev_layer_count - 1:
                    edges.append((prev_layer_start + prev_idx_approx + 1, current_node_idx))

        global_point_offset += current_points_count

    # Save
    vertex = np.array([tuple(p + c) for p, c in zip(points, colors)],
                      dtype=[('x', 'f4'), ('y', 'f4'), ('z', 'f4'), ('red', 'u1'), ('green', 'u1'), ('blue', 'u1')])
    vertex_el = PlyElement.describe(vertex, 'vertex')
    
    edge_array = np.array(edges, dtype=[('vertex1', 'i4'), ('vertex2', 'i4')])
    edge_el = PlyElement.describe(edge_array, 'edge')
    
    # Custom filename based on input
    if mode == 'activation':
        if image_path:
            clean_name = image_path.split("/")[-1].replace('.', '_')
            filename = f"{model_name.replace('/', '_')}_{mode}_{clean_name}.ply"
        else:
            clean_text = "".join(x for x in text if x.isalnum())[:15]
            filename = f"{model_name.replace('/', '_')}_{mode}_{clean_text}.ply"
    else:
        filename = f"{model_name.replace('/', '_')}_{mode}.ply"
        
    PlyData([vertex_el, edge_el], text=True).write(filename) 
    print(f"✨ Saved: {filename}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('model', nargs='?', default='gpt2')
    parser.add_argument('--step', type=int, default=2)
    parser.add_argument('--mode', choices=['default', 'layers', 'heads', 'activation'], default='default', 
                        help="Coloring mode: default, layers (rainbow), heads (structure), activation (heatmap)")
    parser.add_argument('--text', type=str, default="The future is vast and infinite", help="Input text for activation heatmap")
    parser.add_argument('--image', type=str, default=None, help="Input image path for CNN activation heatmap")
    
    args = parser.parse_args()
    extract_and_crystallize(args.model, args.step, args.mode, args.text, args.image)
