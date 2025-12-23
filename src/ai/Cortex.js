
import { pipeline, env } from '@xenova/transformers';

// Force remote models (CDN) to avoid 404/HTML errors
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;

console.log("🧠 CORTEX CONFIG LOADED: Local=False, Remote=True, Cache=False");


class CortexService {
    constructor() {
        this.extractor = null;
        this.status = 'offline'; // offline, loading, ready
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.onProgress = null;
    }

    async init(progressCallback, force = false) {
        if (this.status === 'ready') return;

        // DEFAULT TO PAUSED (Opt-in Flow)
        // We now require explicit activation for everyone to show the "Start" UI
        if (!force) {
            console.log("🧠 Cortex: Waiting for user activation.");
            this.status = 'paused';
            if (progressCallback) progressCallback('paused', 0);
            return;
        }

        console.log("🧠 Cortex Init: Starting Pipeline...");
        console.log("🧠 Cortex Config Check:", env);

        try {
            this.status = 'loading';
            if (progressCallback) progressCallback('loading', 0);

            // Use singleton pipeline
            this.extractor = await pipeline('feature-extraction', this.modelName, {
                // Explicitly request quantized version
                quantized: true,
                progress_callback: (x) => {
                    if (progressCallback) progressCallback(x.status, x.progress);
                }
            });

            this.status = 'ready';
            if (progressCallback) progressCallback('ready', 100);
            console.log("🧠 Cortex Online: Neural Link Established");

        } catch (e) {
            console.error("Cortex Failure:", e);
            this.status = 'error';
            if (progressCallback) progressCallback('error', 0);
        }
    }

    // Projects the 384-dim vector into a normalized 3D vector for the visualizer
    // We use a "Semantic PCA Approximation" - summing specific channels to XYZ
    // This ensures consistent spatial mapping for concepts.
    projectTo3D(embedding) {
        let x = 0, y = 0, z = 0;
        const dims = embedding.data.length; // 384 usually

        // We split the 384 dims into 3 buckets and sum them
        // This is a deterministic projection.
        // To make it distinct, we alternate or weight them.
        for (let i = 0; i < dims; i++) {
            const val = embedding.data[i];
            if (i % 3 === 0) x += val;
            if (i % 3 === 1) y += val;
            if (i % 3 === 2) z += val;
        }

        // Normalize
        const mag = Math.sqrt(x * x + y * y + z * z) || 1;
        return {
            x: (x / mag),
            y: (y / mag),
            z: (z / mag)
        };
    }

    // Modifies the raw embedding based on the Model Architecture
    // This allows "Vision" words to correctly hit the "Vision" part of a CNN, etc.
    applyArchitectureBias(vector, text, architecture) {
        if (!architecture) return vector;

        const concepts = {
            visual: ['image', 'pixel', 'edge', 'color', 'vision', 'see', 'graphic', 'convolution', 'filter'],
            abstract: ['logic', 'reason', 'class', 'label', 'decision', 'category', 'meaning', 'concept'],
            temporal: ['time', 'sequence', 'history', 'future', 'next', 'memory', 'recurrent'],
            audio: ['sound', 'wave', 'music', 'frequency', 'hear', 'audio', 'voice', 'speech']
        };

        const hasConcept = (key) => concepts[key].some(word => text.toLowerCase().includes(word));

        // 1. CNNs (Pyramids): Bottom = Pixels, Top = Logic
        if (architecture.includes('CNN') || architecture.includes('LeNet') || architecture.includes('AlexNet')) {
            if (hasConcept('visual')) {
                vector.y = -0.8; // Force to Bottom (Input Layer)
                vector.x *= 2.0; // Spread out (Wide base)
            } else if (hasConcept('abstract')) {
                vector.y = 0.8; // Force to Top (Output Layer)
                vector.x *= 0.1; // Narrow (Tip of pyramid)
            }
        }

        // 2. Transformers (Columns): Bottom = Embeddings, Middle = Attention, Top = Output
        if (architecture.includes('Transformer') || architecture.includes('GPT') || architecture.includes('Gemini')) {
            if (hasConcept('visual')) {
                if (architecture.includes('Gemini') || architecture.includes('Multi')) {
                    // Gemini has sparse vision patches near top
                    vector.y = 0.5;
                    vector.x = 0.8; // Outer edge
                }
            } else if (hasConcept('audio')) {
                // Audio Wave Layers (Middle)
                vector.y = 0.0;
                vector.z = 0.8; // Front
            } else if (hasConcept('temporal')) {
                // Attention is everywhere, but let's put it in the "Core"
                vector.y = 0.0;
                vector.x = 0.0; // Deep inside
            }
        }

        // 3. RNN/LSTM (Horizontal Flow)
        if (architecture.includes('LSTM') || architecture.includes('RNN')) {
            if (hasConcept('temporal')) {
                vector.x = 0.9; // Forward in time chain
            } else if (hasConcept('memory')) {
                vector.x = -0.5; // Back in memory gate
            }
        }

        return vector;
    }

    async think(text, context = {}) {
        if (this.status !== 'ready') return null;

        // Run inference
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });

        // Project
        let vector3 = this.projectTo3D(output);

        // APPLY ARCHITECTURAL BIAS
        // We assume 'context.arch' is passed, e.g., "CNN", "Transformer"
        vector3 = this.applyArchitectureBias(vector3, text, context.arch || 'Transformer');

        return {
            text: text,
            embedding: output,
            focus: vector3
        };
    }


    // --- SEMANTIC MATH ---
    dotProduct(vecA, vecB) {
        let sum = 0;
        const len = vecA.length;
        for (let i = 0; i < len; i++) sum += vecA[i] * vecB[i];
        return sum;
    }

    magnitude(vec) {
        let sum = 0;
        for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
        return Math.sqrt(sum);
    }

    cosineSimilarity(vecA, vecB) {
        const dot = this.dotProduct(vecA, vecB);
        const magA = this.magnitude(vecA);
        const magB = this.magnitude(vecB);
        return dot / (magA * magB);
    }

    // "Creative" AI: Assess a situation text against a set of concepts
    // Returns the concept with the highest similarity score
    async assess(situationText, concepts = ['good', 'bad']) {
        if (!this.extractor) return null;

        // 1. Embed Situation
        const sitOut = await this.extractor(situationText, { pooling: 'mean', normalize: true });
        const sitVec = sitOut.data;

        // 2. Embed Concepts (We could cache these!)
        let bestConcept = null;
        let bestScore = -1.0;

        for (const concept of concepts) {
            const conOut = await this.extractor(concept, { pooling: 'mean', normalize: true });
            const score = this.cosineSimilarity(sitVec, conOut.data);

            // console.log(`🧠 Assessment: "${situationText}" vs "${concept}" = ${score.toFixed(3)}`);

            if (score > bestScore) {
                bestScore = score;
                bestConcept = concept;
            }
        }

        return {
            match: bestConcept,
            score: bestScore
        };
    }
}

export const cortex = new CortexService();
