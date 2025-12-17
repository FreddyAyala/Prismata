import colorsys
import numpy as np

def get_color(mode, layer_idx, total_layers, neuron_idx, weight_val, activation_val=0):
    """Returns (R, G, B) tuple based on the selected mode."""
    
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
