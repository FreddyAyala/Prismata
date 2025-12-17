# Contributing to Prismata
We welcome contributions to the Neural Architecture Gallery! Whether you want to add a new model visualization or improve the engine, here is how you can help.

## adding a New Model Crystal

Prismata treats each AI model as a "Crystal". To add one, you need three things:
1.  **The Point Cloud (.ply):** The 3D structure.
2.  **The Info Card (INFO.md):** The description.
3.  **The Manifest Entry:** Registering it in the system.

### Step 1: Generate the PLY
You can generate a `.ply` file using our provided python script `scripts/inspect_model.py`.

```bash
# 1. Install dependencies
pip install torch numpy sklearn plyfile transformers

# 2. Run Inspector (Simulated)
python scripts/inspect_model.py --model_name "MyCoolModel" --model_type "transformer" --layers 12 --hidden_size 768 --output "my_model.ply"

# 2b. Run Inspector (Real - Requires Model Weights)
# Coming soon: Script to hook into HuggingFace transformers directly.
```
Move the generated `.ply` file to: `public/crystals/my_model/model.ply` (Create the folder).

### Step 2: Create Info Card
Create `public/crystals/my_model/INFO.md`:
```markdown
# My Cool Model

**Architecture:** Transformer (Decoder-only)
**Shape:** Helix
**Concept:** Next Token Prediction

Description of what makes this model unique...
```

### Step 3: Register in Manifest
Edit `public/crystals/manifest.json`:
```json
{
    "id": "my_model",
    "name": "MY COOL MODEL",
    "year": 2025,
    "type": "LLM",
    "desc": "A brief one-liner.",
    "crystals": [
        { "name": "Structure", "file": "crystals/my_model/model.ply", "desc": "Visualization of weights." }
    ]
}
```

## Guidelines
*   **Aesthetics:** We use a *Tron/Cyberpunk* aesthetic. Keep UI elements dark, transparent, and neon-lit.
*   **Performance:** PLY files should ideally be under 5MB for web performance. Use PCA to reduce dimensions, don't just dump raw weights.
*   **Code Style:** Standard JS (ES6 modules). No build framework is strictly required (Vanilla is King), but we use Vite for dev.
