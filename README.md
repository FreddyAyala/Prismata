# PRISMATA: Neural Architecture Gallery

**Prismata** is an interactive 3D visualization tool that transforms the invisible mathematics of Artificial Intelligence into tangible, crystalline structures. It allows us to "see" the shape of intelligence.

![Prismata Header](https://raw.githubusercontent.com/Starttoaster/Prismata/main/public/preview.png)

## 🔬 The Science: What Are We Seeing?

When you look at a Prismata crystal, you are not looking at random art. You are seeing the actual mathematical topology of the AI model.

### 1. Structure Crystals ("The Brain")
*   **What it is:** A map of the model's **Weights** (its long-term memory).
*   **How it works:** We extract the weight matrices (neurons) from every layer of the model. Since these matrices exist in 4096+ dimensions, we use **PCA (Principal Component Analysis)** to project them down into 3D.
*   **What it means:**
    *   **Clusters:** Groups of neurons that have learned similar features.
    *   **Layers:** The vertical progression represents the depth of the network (Input at the bottom, Output at the top).
    *   **Shape:** A "helix" suggests the model rotates data as it processes it. A "block" suggests rigid, parallel processing.

### 2. Activation Crystals ("The Thought")
*   **What it is:** A map of the model's **Activations** (short-term memory) as it processes a specific input.
*   **How it works:** We feed text (e.g., *"The quick brown fox"*) into the model and record the firing state of every neuron at every millisecond.
*   **What it means:** You are seeing the **trajectory of a thought**. The path the data takes as it flows through the neural pathways, transforming from raw text into abstract understanding.

---

## 🏛️ The Gallery (Evolution of AI)

Prismata acts as a timeline, showcasing the architectural evolution of AI:

*   **1998 | LeNet-5 ("The First Spark")**: The tiny, hand-crafted ancestor of modern Deep Learning.
*   **2015 | ResNet ("The Deep Pyramid")**: The CNN that solved depth, allowing networks to grow from 5 layers to 50+.
*   **2017 | Transformer Era (BERT, GPT-2)**: The rise of Attention. Structures become complex helices (GPT) and pillars (BERT).
*   **2024 | The Reasoning Era (Qwen, DeepSeek)**: Massive, dense structures capable of complex logic.
*   **2025 | Edge AI (SmolLM)**: The return to efficiency—compact, highly optimized "pocket brains".


---

## ❓ FAQ

### Does the model generate these shapes itself?
**Yes and No.**
*   **The Shape**: Is created by the model during training. An untrained model looks like a random fuzzy ball (noise). As it learns patterns, it physically organizes its neurons into clusters, manifolds, and helices. The shape *is* the knowledge.
*   **The Crystal**: Is our visualization of that shape. The model doesn't output `.ply` files; Prismata acts like an **MRI Scanner**, taking a snapshot of the model's internal brain structure and projecting it into 3D.


### 1. View the Gallery (Web)
Prismata is a static web application built with **Vite** and **Three.js**.

```bash
# Install dependencies
npm install

# Run local development server
npm run dev
```
Open `http://localhost:5173` to explore the gallery.

### 2. Generate Your Own Crystals (Python)
You can generate a crystal from ANY Hugging Face model using our Python engine.

**Setup**:
```bash
python3 -m venv venv
source venv/bin/activate
pip install torch transformers scikit-learn numpy plyfile
```

**Generate**:
```bash
# Generate the Structure of a model (e.g., GPT-2)
python scripts/prismata_make.py gpt2 --mode layers

# Generate a "Thought" (Visualizing how it thinks about specific text)
python scripts/prismata_make.py gpt2 --mode activation --text "Artificial General Intelligence is coming."
```
The script outputs a `.ply` file (Point Cloud) which you can view in Prismata.

---

## 🤝 Contributing & Custom Uploads

**Want to visualize your own model?**
1.  Use the Python script above to generate a `.ply` file.
2.  Open the **About Panel** in the Prismata web interface.
3.  Click **"PREVISUALIZE CUSTOM CRYSTAL"** and upload your file.

**Publishing**:
To add your model permanently to the global gallery, read [CONTRIBUTING.md](CONTRIBUTING.md).

---
*Created by [Frederic Ayala](https://www.linkedin.com/in/freddyayala/)*
