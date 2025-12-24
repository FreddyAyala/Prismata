# Crystal Fidelity & Verification Standards

## 1. Asset Structure
Every model in the gallery MUST have a dedicated directory in `public/crystals/{model_id}/` containing:
- **`structure_layers.ply`** (Required): The static 3D lattice of the model's weights.
- **`README.md`** (Required): Metadata card containing Model ID, Parameter count, License, and Generation Logs.
- **Activation Crystal** (Optional but Recommended): At least one `.ply` file visualizing a specific "thought" or input processing (e.g. `activation_hello.ply`).

## 2. Authenticity Rules
- **Real Weights**: Whenever possible, crystals must be generated from `AutoModel.from_pretrained()` using real Hugging Face weights.
- **Simulation Fallback**: If a model is too large (>100GB) or closed-source (GPT-4), strict topological simulations are permitted but MUST be labeled as "Simulation" in `manifest.json`.
- **Legacy Models**: Historical architecture (Perceptrons, RNNs) where weights are meaningless effectively can be synthesized for educational clarity.

## 3. metadata.json (Manifest)
The `public/crystals/manifest.json` entry must strictly follow:
```json
{
  "id": "model_id",
  "name": "Display Name",
  "year": YYYY,
  "era": "Era Name",
  "type": "Architecture Type",
  ...
}
```

## 4. Verification
To verify any crystal:
1. Check `public/crystals/{model_id}/README.md` for reproduction commands.
2. Run the command locally to confirm the `.ply` output matches the committed file.
