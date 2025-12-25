import torch
import torch.nn as nn

class SimpleAlexNet(nn.Module):
    def __init__(self):
        super(SimpleAlexNet, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=11, stride=4, padding=2),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2),
            nn.Conv2d(64, 192, kernel_size=5, padding=2),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2),
            nn.Conv2d(192, 384, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(384, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2),
            nn.MaxPool2d(kernel_size=3, stride=2),
        )

class SimpleVGG16(nn.Module):
    def __init__(self):
        super(SimpleVGG16, self).__init__()
        self.features = nn.Sequential(
            # Block 1
            nn.Conv2d(3, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            # Block 2
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            # Block 3
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            # Block 4
            nn.Conv2d(256, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            # Block 5
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(512, 512, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )

class SimplePerceptron(nn.Module):
    """
    The Single Neuron (1958).
    Just one layer. Input -> Output.
    """
    def __init__(self):
        super(SimplePerceptron, self).__init__()
        # Flattened 28x28 input -> 10 classes
        self.fc = nn.Linear(784, 10)

class SimpleWord2Vec(nn.Module):
    """
    Word2Vec (2013).
    The "King - Man + Woman = Queen" model.
    It's a shallow 2-layer network: Input (One-Hot) -> Projection (Embedding) -> Output.
    """
    def __init__(self):
        super(SimpleWord2Vec, self).__init__()
        vocab_size = 10000
        embed_dim = 300 # Classic 300 dimensions
        
        # We model this as just the Projection weights (The Embeddings)
        # Because the "Model" IS the weights.
        self.embeddings = nn.Linear(vocab_size, embed_dim, bias=False)
        self.output = nn.Linear(embed_dim, vocab_size, bias=False)

class SimpleInception(nn.Module):
    """
    GoogLeNet (Inception v1) Mock.
    Simulating the "Width" / Branching modules.
    We just mock the parallel branches as sequential blocks for the extractor.
    """
    def __init__(self):
        super(SimpleInception, self).__init__()
        self.features = nn.Sequential(
            # Stem
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.MaxPool2d(3, stride=2),
            nn.Conv2d(64, 192, kernel_size=3, padding=1),
            nn.MaxPool2d(3, stride=2),
            # Inception 3a (Mocking branches as stacked layers for viz)
            nn.Conv2d(192, 64, kernel_size=1),   # 1x1
            nn.Conv2d(192, 128, kernel_size=3),  # 3x3
            nn.Conv2d(192, 32, kernel_size=5),   # 5x5
            # Inception 3b
            nn.Conv2d(256, 128, kernel_size=1),
            nn.Conv2d(256, 192, kernel_size=3),
            nn.Conv2d(256, 96, kernel_size=5),
            nn.MaxPool2d(3, stride=2),
            # Inception 4a
            nn.Conv2d(480, 192, kernel_size=1),
            nn.Conv2d(480, 208, kernel_size=3),
            nn.Conv2d(480, 48, kernel_size=5),
        )

class SimpleDeepSeekMOE(nn.Module):
    """
    Mock Architecture for DeepSeek-V3/R1 (Mixture of Experts).
    Simulates sparcity to visualize the 'Active Parameters' concept.
    """
    def __init__(self, num_layers=61, hidden_dim=1024): # Scaled down dim for viz
        super(SimpleDeepSeekMOE, self).__init__()
        self.layers = nn.ModuleList()
        
        for _ in range(num_layers):
            # We create a 'Mock' block that mimics an Attention + MoE layer
            # But we only care about the weights 'extract_weights' finds.
            # standard extractors look for 'attn' or 'self_attn'.
            # We'll make a fake 'self_attn' that is actually the MoE Router/Expert weights 
            # so the visualizer picks it up.
            
            # Sparse Weight Matrix: 90% zeros (Inactive experts), 10% active
            layer = nn.Module()
            layer.self_attn = nn.Module()
            
            # Create a random weight matrix
            # Shape [Hidden, Hidden]
            # We use nn.Linear to hold it
            proj = nn.Linear(hidden_dim, hidden_dim)
            
            # Sparsify it manually
            with torch.no_grad():
                mask = torch.rand_like(proj.weight) > 0.90 # Only 10% active
                proj.weight *= mask.float()
                
                
            layer.self_attn.q_proj = proj # extractors look for this
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim) 
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            
            self.layers.append(layer)


class SimpleNemotron(nn.Module):
    """
    Nemotron 3 Nano Mock (The Agent).
    Hybrid Latent MoE: A dense core with sparse, specialized extensions.
    """
    def __init__(self):
        super(SimpleNemotron, self).__init__()
        self.layers = nn.ModuleList()
        # 30B parameters / 3B active -> High sparsity but dense core
        hidden_dim = 1200 
        num_layers = 48
        
        for i in range(num_layers):
            layer = nn.Module()
            layer.self_attn = nn.Module()
            proj = nn.Linear(hidden_dim, hidden_dim)
            
            with torch.no_grad():
                # Hybrid Structure: 
                # Central "Brain Stem" (Dense) + Specialized "Limbs" (Sparse)
                
                # 1. Background Sparse Noise (The Experts)
                mask = torch.rand_like(proj.weight) > 0.85 # 15% active
                proj.weight *= mask.float()
                
                # 2. Dense Core (The Latent Router)
                # Middle 20% of neurons are highly connected
                center = hidden_dim // 2
                span = hidden_dim // 10
                proj.weight.data[center-span:center+span, center-span:center+span] *= 1.2
                proj.weight.data[center-span:center+span, center-span:center+span] += 0.05 # Ensure non-zero
            
            layer.self_attn.q_proj = proj
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)


class SimpleGPT4(nn.Module):
    """
    GPT-4 Mock (The Colossus).
    Simulating a massive 16-way Mixture of Experts with huge depth.
    """
    def __init__(self):
        super(SimpleGPT4, self).__init__()
        self.layers = nn.ModuleList()
        num_layers = 120 # Massive depth
        hidden_dim = 2048 # Visual scale
        
        for _ in range(num_layers):
            layer = nn.Module()
            layer.self_attn = nn.Module()
            
            # Sparse Weight Matrix: 95% zeros (massive expert specialization)
            proj = nn.Linear(hidden_dim, hidden_dim)
            with torch.no_grad():
                mask = torch.rand_like(proj.weight) > 0.95 
                proj.weight *= mask.float()
                
            layer.self_attn.q_proj = proj 
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)

class SimpleGemini3(nn.Module):
    """
    Gemini 3 Mock (The Omni-Mind).
    Simulating Native Multimodality (Audio, Video, Text combined).
    We simulate this by having 'fused' layers intertwined with modality-specific ones.
    """
    def __init__(self):
        super(SimpleGemini3, self).__init__()
        self.layers = nn.ModuleList()
        # Interleaved structure: Text -> Audio -> Vision -> Fusion
        patterns = ['text', 'audio', 'vision', 'fusion'] 
        num_cycles = 25 # 100 layers total
        hidden_dim = 1536
        
        for i in range(num_cycles * 4):
            mode = patterns[i % 4]
            layer = nn.Module()
            layer.self_attn = nn.Module()
            
            proj = nn.Linear(hidden_dim, hidden_dim)
            
            # Simulate different 'textures' for different modalities via sparsity/distribution
            with torch.no_grad():
                if mode == 'text':
                    # Dense, standard
                    pass 
                elif mode == 'audio':
                    # Wave-like sparsity?
                    mask = torch.rand_like(proj.weight) > 0.6
                    proj.weight *= mask.float() * 1.5 # Higher variance
                elif mode == 'vision':
                    # Blocky sparsity (patches)
                    mask = torch.rand_like(proj.weight) > 0.4
                    proj.weight *= mask.float()
                elif mode == 'fusion':
                    # Ultra-dense, high connectivity
                    proj.weight *= 2.0
            
    # Gemini 3 Logic (Existing)
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)



class SimpleKimiK2(nn.Module):
    """
    Kimi k2 (The Long Context Rail) Mock.
    Simulates infinite context via a 'Rail' structure.
    """
    def __init__(self):
        super(SimpleKimiK2, self).__init__()
        self.layers = nn.ModuleList()
        hidden_dim = 1024
        num_layers = 200 # Very Deep (Long context stack)
        
        for i in range(num_layers):
            layer = nn.Module()
            layer.self_attn = nn.Module()
            proj = nn.Linear(hidden_dim, hidden_dim)
            
            with torch.no_grad():
                # The 'Rail' - Strong diagonal focus (identity preservation)
                # plus periodic cross-bracing
                idx = torch.arange(hidden_dim)
                proj.weight[idx, idx] = 2.0 # Identity spine
                
                # Periodic bracing
                if i % 10 == 0:
                    proj.weight *= 1.5 # Stronger layer
            
            layer.self_attn.q_proj = proj
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)


def get_model_structure(model):
    """Auto-detects layer list and attention submodule for different architectures."""
    layers = None
    if hasattr(model, 'h'): layers = model.h  # GPT-2
    elif hasattr(model, 'encoder') and hasattr(model.encoder, 'layer'): layers = model.encoder.layer # BERT
    elif hasattr(model, 'layers'): layers = model.layers # Llama/Mistral
    elif hasattr(model, 'model') and hasattr(model.model, 'layers'): layers = model.model.layers # Llama-2
    
    elif hasattr(model, 'encoder') and hasattr(model.encoder, 'stages'):
        layers = []
        for stage in model.encoder.stages:
            for layer in stage.layers:
                layers.append(layer)
        return layers

    # CLIP Support (Text + Vision)
    elif hasattr(model, 'text_model') and hasattr(model, 'vision_model'):
        layers = []
        # Text Encoder
        if hasattr(model.text_model, 'encoder'): 
            layers.extend(model.text_model.encoder.layers)
        # Vision Encoder
        if hasattr(model.vision_model, 'encoder'): 
            layers.extend(model.vision_model.encoder.layers)
        return layers

    # T5 Support (Encoder + Decoder)
    elif hasattr(model, 'encoder') and hasattr(model, 'decoder'):
        layers = []
        if hasattr(model.encoder, 'block'): layers.extend(model.encoder.block)
        if hasattr(model.decoder, 'block'): layers.extend(model.decoder.block)
        return layers

    # Generic CNN (MobileNet, VGG, EfficientNet) - usually has 'features'
    elif hasattr(model, 'features'):
         return model.features

    # MobileNetV2 uses 'layer'
    elif hasattr(model, 'layer'):
        return model.layer


    if layers is None:
        # Check for Perceptron (Simple Linear)
        if hasattr(model, 'fc'):
             return [model.fc]
        # Check for Word2Vec
        if hasattr(model, 'embeddings'):
             return [model.embeddings, model.output]
        raise ValueError(f"Architecture {type(model).__name__} not supported.")

    return layers



class SimpleClaude35(nn.Module):
    """
    Claude 3.5 Sonnet (Mock).
    "The Artifact" - A highly structured, safe, and steerable lattice.
    """
    def __init__(self):
        super(SimpleClaude35, self).__init__()
        self.layers = nn.ModuleList()
        # 50 Layers
        hidden_dim = 2048 
        for i in range(50):
            layer = nn.Module()
            layer.self_attn = nn.Module()
            proj = nn.Linear(hidden_dim, hidden_dim)
            with torch.no_grad():
                # Structure: A Dense Volumetric Block (The Monolith)
                # 1. Start with dense Gaussian noise (Real Weight Look)
                nn.init.normal_(proj.weight, mean=0.0, std=0.02)
                
                # 2. Apply "Constitutional" Constraints (Shaping)
                # Clamp values to create hard edges (The Box effect) but keep density inside
                proj.weight.data = torch.clamp(proj.weight.data, -0.05, 0.05)
                
                # 3. Add explicit structure banding
                # Creates horizontal "layers" of logic visible in the density
                for j in range(0, hidden_dim, 200):
                    if j + 50 < hidden_dim:
                        proj.weight.data[j:j+50, :] *= 1.5 # Denser bands
            
            layer.self_attn.q_proj = proj
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)



class SimplePhi35(nn.Module):
    """
    Phi 3.5 (Mock Fallback).
    Used when real weight download fails.
    """
    def __init__(self):
        super(SimplePhi35, self).__init__()
        self.layers = nn.ModuleList()
        hidden_dim = 2048
        # 32 Layers (standard for small models)
        for i in range(32):
            layer = nn.Module()
            layer.self_attn = nn.Module()
            # Dense, uniform structure (Textbook quality)
            proj = nn.Linear(hidden_dim, hidden_dim)
            layer.self_attn.q_proj = proj
            layer.self_attn.k_proj = nn.Linear(hidden_dim, hidden_dim) 
            layer.self_attn.v_proj = nn.Linear(hidden_dim, hidden_dim)
            self.layers.append(layer)
