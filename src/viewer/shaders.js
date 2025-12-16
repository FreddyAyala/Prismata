export const flowVertexShader = `
    attribute vec3 color;
    varying vec3 vColor;
    varying float vZ;
    uniform float uSize;

    void main() {
        vColor = color;
        // Normalize Z loosely to 0-1 range if possible, but raw Z is fine if wave frequency mimics it.
        vZ = position.z; 
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Size attenuation: 
        // uSize is base size (e.g. 10.0)
        // Divide by depth (-mvPosition.z)
        gl_PointSize = uSize * (30.0 / -mvPosition.z); 

        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const flowFragmentShader = `
    uniform float uTime;
    varying vec3 vColor;
    varying float vZ;

    void main() {
        // Round particles (Soft Circle)
        vec2 uv = gl_PointCoord - 0.5;
        float dist = length(uv);
        if (dist > 0.5) discard;
        
        // Soft edge
        float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

        // Pulse Animation
        // Wave travels vertically (+Z direction)
        // Frequency: 1.0 (spatial)
        // Speed: 4.0 (temporal)
        float wave = sin(vZ * 0.5 - uTime * 4.0);
        
        // Make it a sparse pulse (mostly 'off', briefly 'on')
        float pulse = smoothstep(0.95, 1.0, wave);

        // Mix base Color with Pulse Color (Cyan/White)
        vec3 pulseColor = vec3(0.5, 1.0, 1.0);
        vec3 col = mix(vColor, pulseColor, pulse * 0.8);

        // Output
        gl_FragColor = vec4(col, 1.0); 
    }
`;
