# DeepSeek Crystal Collection

**Architecture:** Mixture of Experts (DeepSeek-V3/R1)
**Shape:** The Sparse Cloud
**Concept:** Routing Logic

DeepSeek-V3 is a "Mixture of Experts" model. Unline dense models (like Llama 3) where every neuron fires, DeepSeek routes tokens to specific expert clusters. This creates a "Cloud" structure with distinct high-density regions (experts) separated by sparse routing pathways.

## Visualizations

### 1. Structural Crystals
*   **`structure_layers.ply`**: (Simulated) A visualization of the MoE routing topology.
    *   **Structure**: You can see the "Expert Clusters" floating within the sparse cloud.
