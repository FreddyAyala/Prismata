import torch
from transformers import AutoModel, AutoTokenizer, AutoImageProcessor
import torch.nn as nn
from sklearn.decomposition import PCA
import numpy as np
from plyfile import PlyData, PlyElement
import sys
import argparse
from PIL import Image

def get_model_structure(model):
    """Auto-detects layer list and attention submodule for different architectures."""
    layers = None
    if hasattr(model, 'h'): layers = model.h  # GPT-2
    elif hasattr(model, 'encoder') and hasattr(model.encoder, 'layer'): layers = model.encoder.layer # BERT
    elif hasattr(model, 'layers'): layers = model.layers # Llama/Mistral
    elif hasattr(model, 'model') and hasattr(model.model, 'layers'): layers = model.model.layers # Llama-2
    
    # CNN Support (ResNet)
    # ResNet has 'stages', and each stage has 'layers'. We want to flatten this into one long list of blocks.
    elif hasattr(model, 'encoder') and hasattr(model.encoder, 'stages'):
        layers = []
        for stage in model.encoder.stages:
            for layer in stage.layers:
                layers.append(layer)
        return layers

    if layers is None:
        raise ValueError(f"Architecture {type(model).__name__} not supported.")

    return layers

def extract_weights(block):
    """
    Universal extractor: Finds Attention OR Convolution weights.
    Returns: numpy array of shape (Hidden_Dim, Features)
    """
    # 1. Try Attention (GPT/BERT/Llama)
    if hasattr(block, 'attn') and hasattr(block.attn, 'c_attn'):
        return block.attn.c_attn.weight.detach().numpy()
    
    if hasattr(block, 'attention') and hasattr(block.attention, 'self'):
        q = block.attention.self.query.weight.detach().numpy().T
        k = block.attention.self.key.weight.detach().numpy().T
        v = block.attention.self.value.weight.detach().numpy().T
        return np.concatenate([q, k, v], axis=1)

    if hasattr(block, 'self_attn'):
        if hasattr(block.self_attn, 'q_proj'):
            q = block.self_attn.q_proj.weight.detach().numpy().T
            k = block.self_attn.k_proj.weight.detach().numpy().T
            v = block.self_attn.v_proj.weight.detach().numpy().T
            return np.concatenate([q, k, v], axis=1)

    # 2. Try Convolution (ResNet)
    # ResNet blocks (Bottleneck) usually have 3 convs. The middle one (convolution) is the main 3x3.
    # HF ResNet Layer structure: layer[i].convolution (if simplified) or specific naming.
    # In HF `ResNetLayer`: has `convolution` (3x3) or `shortcut`.
    for name, module in block.named_modules():
        if isinstance(module, nn.Conv2d):
            # We found a convolution!
            # Shape: [Out_Channels, In_Channels, Kernel, Kernel]
            # e.g., [64, 64, 3, 3] -> Flatten to [64, 576]
            w = module.weight.detach().numpy()
            out_ch, in_ch, kh, kw = w.shape
            
            # Reshape to 2D: [Out_Neurons, All_Input_Features]
            # We treat Out_Channels as the "Neurons" of this layer
            return w.reshape(out_ch, -1).T 
            # Note: We Transpose (.T) because our PCA logic assumes [Samples, Features].
            # Here "Samples" are the neurons (Out_Channels). So we want shape [Out_Ch, In_Features]
            # Wait, `extract_and_crystallize` expects [Features, Neurons] generally?
            # GPT2 weight is [768, 2304]. Input=768, Output=2304.
            # We usually Transpose it in the main loop: `data_slice = attn_weights.T[::step]`
            # So `extract_weights` should return [Input, Output].
            # For Conv: [Out, In*K*K]. We want [In*K*K, Out].
            
            return w.reshape(out_ch, -1).T

    return None

def get_activations(model, model_name, text="The future is vast and infinite", image_path=None):
    """Runs a forward pass to capture neuron activation intensity."""
    activations = {}
    layers = get_model_structure(model)
    
    # Universal Hook
    def get_hook(layer_idx):
        def hook(module, input, output):
            # Output might be tuple
            data = output[0] if isinstance(output, tuple) else output
            data = data.detach()
            
            # Shape Handling
            if len(data.shape) == 3: # Transformer [Batch, Seq, Dim]
                activations[layer_idx] = data[0].mean(dim=0).numpy()
            elif len(data.shape) == 4: # CNN [Batch, Channels, H, W]
                # Mean over Height and Width to get average activation per Channel (Neuron)
                activations[layer_idx] = data[0].mean(dim=(1, 2)).numpy()
            elif len(data.shape) == 2: # Linear [Batch, Dim]
                activations[layer_idx] = data[0].numpy()
            else:
                activations[layer_idx] = data.mean().numpy()
        return hook

    hooks = []
    # CNNs (ResNet) have nested structures. We need to hook the 'convolution' layers or the blocks.
    # For ResNet, `layers` is a flat list of blocks. We hook the block output.
    for i, block in enumerate(layers):
        hooks.append(block.register_forward_hook(get_hook(i)))
    
    # INPUT HANDLING
    try:
        if image_path:
            print(f"👁️ Seeing image: '{image_path}'...")
            image = Image.open(image_path)
            processor = AutoImageProcessor.from_pretrained(model_name)
            inputs = processor(images=image, return_tensors="pt")
            model(**inputs)
        else:
            print(f"🧠 Thinking about: '{text}'...")
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            inputs = tokenizer(text, return_tensors="pt")
            model(**inputs)
            
    except Exception as e:
        print(f"Warning during forward pass: {e}")
    
    for h in hooks: h.remove()
    return activations

def get_color(mode, layer_idx, total_layers, neuron_idx, weight_val, activation_val=0):
    """Returns (R, G, B) tuple based on the selected mode."""
    import colorsys
    
    if mode == 'layers':
        # HSV Spectrum: Bottom layers = Red, Top layers = Violet
        hue = layer_idx / (total_layers + 1)
        r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
        return int(r*255), int(g*255), int(b*255)
        
    elif mode == 'heads':
        # GPT-2 has 12 heads. Map neuron index to head index.
        # hidden_size=768 / 12 heads = 64 neurons per head
        head_idx = (neuron_idx // 64) % 12
        
        # Distinct colors for heads to show "stripes" of processing
        hue = head_idx / 12.0
        r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 1.0)
        return int(r*255), int(g*255), int(b*255)
        
    elif mode == 'activation':
        # Heatmap: Dark Blue (Quiet) -> Red (LOUD) -> White (BLINDING)
        # Activation val is usually 0-10ish. Normalize locally.
        
        intensity = np.tanh(activation_val) # Squish to 0-1 range roughly
        
        # Cold (Inactive)
        if intensity < 0.2:
            return 20, 20, 50 
        
        # Hot (Active)
        # Blend from Blue to Red to Yellow
        val = (intensity - 0.2) / 0.8
        val = max(0, min(1, val))
        
        # Simple Heatmap Gradient
        r, g, b = colorsys.hsv_to_rgb(0.66 - (val * 0.66), 1.0, val * 255) # Blue to Red
        return int(colorsys.hsv_to_rgb(0.0 + (1.0-val)*0.6, 1.0, 1.0)[0]*255), int(val*255), int(val*50)
        # Actually standard simple heatmap:
        return int(val*255), int(max(0, val*255 - 100)), int(max(0, 255 - val*500))

    else:
        # Default "Ice"
        intensity = int(np.clip(weight_val * 800, 50, 255))
        return intensity, 200 + int(intensity*0.2), 255

def extract_and_crystallize(model_name='bert-base-uncased', step=2, mode='layers', text="The future is vast and infinite", image_path=None):
    print(f"💎 Loading universal model: {model_name}...")
    try:
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
