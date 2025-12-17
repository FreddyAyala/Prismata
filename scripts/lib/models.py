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
        )

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
        raise ValueError(f"Architecture {type(model).__name__} not supported.")

    return layers
