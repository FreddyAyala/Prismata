from transformers import AutoModel
import sys
model_name = "google/mobilenet_v2_1.0_224"
try:
    model = AutoModel.from_pretrained(model_name)
    print(f"Model Type: {type(model).__name__}")
    print(f"Has features? {hasattr(model, 'features')}")
    print(f"Dir: {dir(model)}")
except Exception as e:
    print(e)
