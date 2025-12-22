# PRISMATA: Neural Architecture Gallery

**Prismata** is an interactive 3D visualization tool that transforms the invisible mathematics of Artificial Intelligence into tangible, crystalline structures. It allows us to "see" the shape of intelligence.


![Prismata Header](assets/prismata.png)

## 🚀 Quick Start

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Launch Local Server**:
    ```bash
    npm run dev
    ```
3.  **Explore**: Open [http://localhost:5173](http://localhost:5173) in your browser.

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

### ⚠️ Data Fidelity Disclaimer
While Prismata strives for mathematical accuracy, some models in this gallery are **Architectural Simulations** designed for educational clarity.

*   **Real Weights:** Models like **GPT-2, BERT, ResNet, and SmolLM** are generated from actual pre-trained Hugging Face weights.
*   **Simulations:** Models like **DeepSeek-V3, GPT-4, and Gemini 3.0** use mock weights to verify *topology* (e.g., Sparsity/MoE structure) without requiring impractical downloads.
*   **Historical/Conceptual:** Models like the **Perceptron, MLP, LSTM, and GAN** are synthesized to visualize the *concept* of their architecture. Raw weights from these eras often lack the clear visual structure needed to tell their story effectively.

---

## 🏛️ The Gallery (Evolution of AI)

Prismata acts as a timeline, showcasing the architectural evolution of AI:

*   **1958 | The Perceptron**: The single linear plane that started it all.
*   **1974 | The AI Winter**: A void of shattered dreams and frozen funding.
*   **1986 | Multi-Layer Perceptron**: The awakening. Backpropagation solves the XOR problem.
*   **1997 | LSTM**: Memory. The first time neural networks could remember sequence and time.
*   **1998 | LeNet-5**: The ancestor of Convolutional Neural Networks.
*   **2012 | AlexNet**: The spark that ignited the Deep Learning revolution.
*   **2013 | Word2Vec**: Teach machines the meaning of words.
*   **2014 | VGG-16 & Inception**: The race for depth and complexity.
*   **2014 | GAN (Generative Adversarial Networks)**: The creative duel. Two networks fighting to create reality.
*   **2015 | ResNet-50**: Solving the vanishing gradient problem.
*   **2018 | BERT & MobileNet**: Transformers for language and efficient vision.
*   **2019 | GPT-2**: The dawn of generative language models.
*   **2020 | T5**: The Universal Transformer (Text-to-Text).
*   **2021 | CLIP**: Bridging Vision and Language.
*   **2023 | GPT-4 & TinyLlama**: Massive scale meets compact efficiency.
*   **2024 | Qwen 2.5 & Gemma 2**: The Reasoning Era begins.
*   **2025 | DeepSeek-V3 & SmolLM2**: Sparse Mixtures of Experts and Edge AI.
*   **2026 | Gemini 3.0**: The Omni Era – seeing, hearing, and speaking as one.
*   **2025 | Gemma 3 & Kimi k2**: The Triad (Multimodal Fusion) and The Rail (Infinite Context).
*   **2024 | Claude 3.5 & Llama 3**: The Age of Agents and Open Weights.

## 🚀 Features

### 1. The Workbench (Analysis)
The primary interface for examining individual crystals.
*   **Rotate/Zoom:** Inspect the topology from any angle.
*   **Compare Mode:** Load two models side-by-side to analyze architectural differences (e.g. *GPT-2 vs BERT*).

### 2. The Timeline (Evolution)
A horizontal scrolling journey through history.
*   **Context:** See where each model fits in the timeline.
*   **Flow:** Smoothly transition between eras.

### 3. Virtual Archive (Immersion) 🆕
A first-person 3D experience inspired by *Tron*.
*   **Walk the Hall:** physically walk down the timeline of AI History.
*   **Scale:** Experience the sheer scale of modern models.
*   **Controls:** WASD to move, Mouse to look. ESC to exit.

### 5. Cinematic Auto-Tour & Neural Sonification 🎵
Experience the gallery as a hands-free, audio-visual journey.
*   **Auto-Tour:** Simply click "**▶ AUTO-TOUR**" in the Timeline. The camera will automatically glide through history, zooming in on key architectural details.
*   **Neural Sonification:** A generative audio engine reads the "DNA" of each model (Year, Parameter Count, Architecture Type) and synthesizes a **Unique Audio Signature** in real-time.
    *   **1950s:** Pure Analog Sine Waves.
    *   **2020s:** Ethereal, Complex Glass Pads.
    *   **The Signature:** A unique melodic motif generated from the model's name hash.

### 6. Operation Firewall (Defense Mode) 🛡️
A hidden survival mode where you protect the crystals from corruption.
*   **The Mission:** Defend the Gallery from waves of "Glitch Entities" trying to destabilize the neural topology.
*   **Arsenal:** Procedural weaponry (Blaster, Shotgun, Plasma) generated from the model's own parameters.
*   **Access:** Press **'P'** inside the Archive, or find the **Glitch Platform** (Coordinates: 10, 0, 20).


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

## 📜 Changelog

*   **v2.0.0**: **Cinematic Auto-Tour** & **Neural Sonification**.
    *   Hands-free "Museum Mode" with dynamic camera paths.
    *   Generative Audio Engine: Unique sound signatures for every model based on their architectural DNA.
    *   Sci-Fi Soundscapes: Ethereal padding and subtle transitions.
*   **v1.2.0**: Added **Operation Firewall (Defense Mode)**.
*   **v1.1.0**: Timeline Expansion (Gemini 3.0, DeepSeek-V3, Qwen 2.5, SmolLM, etc.).
*   **v1.0.0**: Initial Release.

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
