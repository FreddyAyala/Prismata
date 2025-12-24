# Nemotron 3 Nano (30B / 3B Active)

**Architecture:** Hybrid Latent Mixture-of-Experts (MoE)
**Parameters:** 30 Billion (3 Billion Active)
**Concept:** Open Foundation for Agentic AI
**Source:** [Nvidia News](https://nvidianews.nvidia.com/news/nvidia-debuts-nemotron-3-family-of-open-models)
**Released:** December 2025

## Description
Nemotron 3 Nano is the smallest in the Nemotron 3 family, designed for targeted, highly efficient agentic tasks. It delivers 4x throughput compared to predecessors using a breakthrough hybrid latent MoE architecture.

## Generation Log
- **Structure:** `python3 scripts/prismata_make.py nvidia/Nemotron-Mini-4B-Instruct --step 4`
  *(Note: Visualized using Nemotron-Mini-4B as a structural proxy for the 3B Active parameters of Nano)*
- **Activation:** `python3 scripts/prismata_make.py ...`

## Generation Log
- **Structure:** `python3 scripts/prismata_make.py nvidia/Nemotron-Mini-4B-Instruct --step 4`
- **Activation:** `python3 scripts/prismata_make.py nvidia/Nemotron-Mini-4B-Instruct --mode activation --text "Intelligence is the efficient compression of information." --step 4`

Generated using **Real Weights** from the official Nvidia Hugging Face repository.
