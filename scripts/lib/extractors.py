import numpy as np
import torch.nn as nn
from PIL import Image
from transformers import AutoTokenizer, AutoImageProcessor
from lib.models import get_model_structure

def extract_weights(block):
    """
    Universal extractor: Finds Attention OR Convolution weights.
    Returns: numpy array of shape (Hidden_Dim, Features)
    """
    # 0. T5 Block (Structure is inside .layer[0])
    if hasattr(block, 'layer') and len(block.layer) > 0 and hasattr(block.layer[0], 'SelfAttention'):
        sa = block.layer[0].SelfAttention
        q = sa.q.weight.detach().numpy().T
        k = sa.k.weight.detach().numpy().T
        v = sa.v.weight.detach().numpy().T
        return np.concatenate([q, k, v], axis=1)

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
