import * as THREE from 'three';

export class PLYParser {
  static parse(buffer, customUniforms) {
    const decoder = new TextDecoder();
    let headerEndIndex = 0;
    const chunk = decoder.decode(buffer.slice(0, 2048));
    const idx = chunk.indexOf("end_header\n");
    if (idx !== -1) headerEndIndex = idx + "end_header\n".length;

    const headerText = decoder.decode(buffer.slice(0, headerEndIndex));
    const body = buffer.slice(headerEndIndex);

    const vertexCount = parseInt(headerText.match(/element vertex (\d+)/)?.[1] || 0);
    const edgeCount = parseInt(headerText.match(/element edge (\d+)/)?.[1] || 0);

    const textData = decoder.decode(body).trim().split(/\s+/);
    let ptr = 0;

    const positions = [];
    const colors = [];

    // Read Vertices
    for (let i = 0; i < vertexCount; i++) {
      const x = parseFloat(textData[ptr++]);
      const y = parseFloat(textData[ptr++]);
      const z = parseFloat(textData[ptr++]);
      const r = parseInt(textData[ptr++]) / 255;
      const g = parseInt(textData[ptr++]) / 255;
      const b = parseInt(textData[ptr++]) / 255;
      positions.push(x, y, z);
      colors.push(r, g, b);
    }

    // Read Edges
    const edgeIndices = [];
    for (let i = 0; i < edgeCount; i++) {
      const v1 = parseInt(textData[ptr++]);
      const v2 = parseInt(textData[ptr++]);
      edgeIndices.push(v1, v2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.center();

    // Group
    const group = new THREE.Group();

    // --- POINTS (Material with Pulse & Density) ---
    const pointMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    pointMaterial.onBeforeCompile = (shader) => {
      // Inject Custom Uniforms
      shader.uniforms.uTime = customUniforms.uTime;
      shader.uniforms.uPulseEnabled = customUniforms.uPulseEnabled;
      shader.uniforms.uNodeDensity = customUniforms.uNodeDensity;
      shader.uniforms.uNodeDist = customUniforms.uNodeDist;
      shader.uniforms.uLFO = customUniforms.uLFO;

      shader.vertexShader = `
          varying float vPulse;
          uniform float uTime;
          uniform float uPulseEnabled;
          uniform float uNodeDensity;
          uniform float uNodeDist;
          uniform float uLFO;
        ` + shader.vertexShader;

      // Pulse Logic
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
          #include <worldpos_vertex>

          // 1. Random Density
          float densityRand = fract(sin(dot(position.xy ,vec2(12.9898,78.233))) * 43758.5453);
          if (densityRand > uNodeDensity) {
              gl_Position = vec4(10.0, 10.0, 10.0, 1.0); // Clip
          }

          // 2. Node Distance (Vertical Focus)
          if (abs(position.y) > uNodeDist * 0.8) {
             // Logic reserved if user wants to hide ends
          }

          vPulse = 0.0;
          if (uPulseEnabled > 0.5) {
              // Y-AXIS DATA FLOW (Bottom to Top)
              float speed = 12.0;
              float range = 60.0;
              float offset = -30.0;

              float scan = mod(uTime * speed, range) + offset;
              float dist = abs(position.y - scan);

              if (dist < 6.0) {
                 vPulse = 1.0 - (dist / 6.0);
                 vPulse = pow(vPulse, 2.0); // Glow curve

                 // Expand active nodes
                 gl_PointSize *= (1.0 + vPulse * 1.5);
              }
          }
          `
      );

      shader.fragmentShader = `
          varying float vPulse;
          uniform float uTime;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          if (vPulse > 0.01) {
             // Artistic Gradient: Gold -> Cyan -> Magenta
             // We can simulate height via vColor if the ply has colored layers?
             // Or just use the Plasma mix approach for consistency.

             vec3 colInput = vec3(1.0, 0.8, 0.2); // Warm
             vec3 colMid   = vec3(0.0, 1.0, 1.0); // Cyan
             vec3 colOut   = vec3(1.0, 0.2, 0.8); // Magenta

             vec3 pulseCol = mix(colMid, colOut, sin(uTime * 3.0) * 0.5 + 0.5);

             // Core is white
             vec3 finalCol = mix(pulseCol, vec3(1.0), vPulse * 0.5);

             diffuseColor.rgb = mix(diffuseColor.rgb, finalCol, vPulse);
          }
          `
      );
    };

    const mesh = new THREE.Points(geometry, pointMaterial);
    group.add(mesh);

    // --- XOR LINES (Material with XOR, Density, Thinning) ---
    if (edgeIndices.length > 0) {
      // Needs "aLineSeed" for consistent XOR calculation per line
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', geometry.getAttribute('position'));
      lineGeometry.setIndex(edgeIndices);

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.2, // Base opacity (controlled by Thinning)
        blending: THREE.AdditiveBlending
      });

      lineMaterial.onBeforeCompile = (shader) => {
        // Link uniforms
        shader.uniforms.uLineDensity = customUniforms.uLineDensity;
        shader.uniforms.uThinning = customUniforms.uThinning;
        shader.uniforms.uXorDensity = customUniforms.uXorDensity;
        shader.uniforms.uLineDist = customUniforms.uLineDist;

        // Pulse Uniforms for Lines
        shader.uniforms.uTime = customUniforms.uTime;
        shader.uniforms.uPulseEnabled = customUniforms.uPulseEnabled;

        shader.vertexShader = `
              uniform float uLineDensity;
              uniform float uThinning;
              uniform float uXorDensity;
              uniform float uLineDist;

              uniform float uTime;
              uniform float uPulseEnabled;

              varying float vVisible;
              varying float vPulse;
            ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
                #include <begin_vertex>
                
                vVisible = 1.0;
                vPulse = 0.0;

                // 1. Density Check
                float seed = fract(sin(dot(position.xyz, vec3(1.0, 2.0, 3.0))) * 43758.5453);
                if (seed > uLineDensity) {
                    vVisible = 0.0;
                }

                // 2. XOR Logic
                if (uXorDensity > 0.01) {
                     float gridSize = 5.0;
                     float cx = floor(position.x / gridSize);
                     float cy = floor(position.y / gridSize);
                     float cz = floor(position.z / gridSize);
                     float pattern = mod(cx + cy + cz, 2.0);
                     if (pattern > 0.5 && uXorDensity > 0.5) {
                        vVisible = 0.0;
                     }
                     float noise = fract(sin(dot(vec2(cx, cy), vec2(12.9, 78.2))) * 43758.5453);
                     if (noise < uXorDensity) {
                        vVisible = 0.0; 
                     }
                }

                // 3. Line Distance
                if (abs(position.y) > uLineDist) {
                    vVisible = 0.0;
                }

                // 4. NEURAL PULSE (Data Flow)
                // Travel from Bottom (-Y) to Top (+Y)
                if (uPulseEnabled > 0.5) {
                    float speed = 12.0;
                    float range = 60.0; // Height of model approx
                    float offset = -30.0; // Start point

                    // Sawtooth wave pos
                    float scan = mod(uTime * speed, range) + offset;

                    // Distance from scan line
                    float dist = abs(position.y - scan);

                    // Glow band size = 5.0
                    if (dist < 5.0) {
                        // Inverse square falloff for glow
                        vPulse = 1.0 - (dist / 5.0);
                        vPulse = pow(vPulse, 3.0); // Sharpen curve
                    }
                }
                `
        );

        shader.fragmentShader = `
              uniform float uThinning;
              uniform float uTime;
              varying float vVisible;
              varying float vPulse;
            ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `
                if (vVisible < 0.1) discard;
                #include <color_fragment>
                
                // Pulse Color Override (Artistic Gradient)
                if (vPulse > 0.01) {
                    // Normalize Height roughly -30 to +30
                    // We need 'vPos' passed from vertex, but we don't have it here yet.
                    // Actually, let's assume Uniform Color based on vPulse phase?
                    // Or better: Let's pass vHeight from vertex.

                    // Since I can't easily add a varying without changing vertex shader structure significantly in this tool call...
                    // Wait, I AM editing the vertex shader injector too in previous step.
                    // Let's rely on the fact that vColor or diffuseColor is already set.

                    // Let's use a Time-based Cycle + Pulse to make it "Rainbow" or "Plasma"
                    // Or just hardcode the "Cyberpunk" palette trio:

                    vec3 colInput = vec3(1.0, 0.6, 0.0); // Gold
                    vec3 colMid   = vec3(0.0, 0.9, 1.0); // Cyan
                    vec3 colOut   = vec3(1.0, 0.0, 0.5); // Magenta

                    // We can use uTime to cycle the color of the PULSE itself as it travels?
                    // The pulse travels. So we can determine color by the pulse "Scan" uniform?
                    // No, scan is local var.

                    // Simple Hack: Use gl_FragCoord.y if we want screen space, OR just a cool mixed color.
                    // Let's go for "Electric Plasma" (Cyan + Purple mix)

                    vec3 plasma = mix(colMid, colOut, sin(uTime * 2.0) * 0.5 + 0.5);

                    // Add some "Sparkle" noise if we can?
                    // No noise function available in stdlib here without injection.

                    // Let's just make it BRIGHT and Colorful.
                    vec3 finalPulse = mix(colInput, plasma, vPulse); // Edges gold, center plasma?

                    diffuseColor.rgb = mix(diffuseColor.rgb, plasma, vPulse * 0.9);
                    diffuseColor.a += vPulse * 0.8; // High visibility

                    // "Overdrive" brightness
                    diffuseColor.rgb += vec3(0.2, 0.2, 0.2) * vPulse;
                }

                // Thinning
                diffuseColor.a = mix(diffuseColor.a, 0.0, uThinning);
                `
        );
      };

      const wireframe = new THREE.LineSegments(lineGeometry, lineMaterial);
      group.add(wireframe);
    }

    return {
      meshResult: group,
      stats: {
        nodes: vertexCount,
        links: edgeCount,
        layers: 10
      }
    };
  }
}
