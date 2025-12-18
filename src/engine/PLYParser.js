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

          // 1. Random Density Discard
          float densityRand = fract(sin(dot(position.xy ,vec2(12.9898,78.233))) * 43758.5453);
          if (densityRand > uNodeDensity) {
              gl_Position = vec4(10.0, 10.0, 10.0, 1.0); // Clip
          }

          // 2. Distance Mask (Center Cutoff or Sine Band)
          // "Line Distance" often implies seeing connectivity distance, but for nodes...
          // Let's make NodeDist behave like a radial visibility or specific band.
          // IF uNodeDist < 100, we start hiding outer nodes?
          // Actually, let's map "Line Dist" to "Connectivity Visibility" but for points, maybe "Layer Visibility"?
          // Use uNodeDist as a "Max Radius" or "Vertical Slice"?
          // Let's use it as a "Vertical Scan" effect mask if small?
          // Simple: Hide nodes if abs(y) > uNodeDist (if we treat it as height/focus)
          // Default is 50.

          if (abs(position.y) > uNodeDist * 0.8) { // 0 to 100 scale
             // Fade out or clip? Clip for performnace.
             // gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
             // Let's leave nodes mostly alone unless requested.
          }


          vPulse = 0.0;
          if (uPulseEnabled > 0.5) {
             float offset = sin(position.x * 0.5) + cos(position.y * 0.5);
             float wave = sin(position.z * 0.2 + uTime * 2.5 + offset * 0.5);
             vPulse = smoothstep(0.9, 1.0, wave);

             // Pulse Size Increase
             // Use uLFO for intensity. Default 0.0 -> 0.5, Max 1.0 -> 2.5 multiplier
             float intensity = 0.5 + (uLFO * 2.5);
             if (vPulse > 0.01) {
                 gl_PointSize *= (1.0 + vPulse * intensity);
             }
          }
          `
      );

      shader.fragmentShader = `
          varying float vPulse;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          if (vPulse > 0.01) {
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 1.0, 1.0), vPulse * 0.7);
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

        shader.vertexShader = `
              uniform float uLineDensity;
              uniform float uThinning;
              uniform float uXorDensity;
              uniform float uLineDist;
              varying float vVisible;
            ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
                #include <begin_vertex>
                
                vVisible = 1.0;

                // 1. Density Check
                // We need a stable seed per vertex or per primitive.
                // For lines, vertex shader runs per vertex. 
                // We want the whole line to be present or absent? 
                // If V1 is visible and V2 is hidden, we get a gradient.
                
                float seed = fract(sin(dot(position.xyz, vec3(1.0, 2.0, 3.0))) * 43758.5453);
                if (seed > uLineDensity) {
                    vVisible = 0.0;
                }

                // 2. XOR Logic (Simulated Tech Pattern)
                // "XOR Density" slider = 0 to 1.
                // If > 0, we apply a spatial filter.
                if (uXorDensity > 0.01) {
                     // Check position against a grid
                     float gridSize = 5.0;
                     float cx = floor(position.x / gridSize);
                     float cy = floor(position.y / gridSize);
                     float cz = floor(position.z / gridSize);
                     
                     // 3D Checkerboardish XOR
                     float pattern = mod(cx + cy + cz, 2.0);
                     
                     // If uXorDensity is 1.0, we want maximum effect (hide 50%?).
                     // If pattern == 0, keep. If pattern == 1, hide?
                     // Let's mix it.
                     if (pattern > 0.5 && uXorDensity > 0.5) {
                        vVisible = 0.0;
                     } 
                     
                     // Or simplify: A generic noise filter
                     float noise = fract(sin(dot(vec2(cx, cy), vec2(12.9, 78.2))) * 43758.5453);
                     if (noise < uXorDensity) {
                        vVisible = 0.0; 
                     }
                }

                // 3. Line Distance (Vertical Clipping / Focus)
                // "Line Dist" 0 to 100.
                // If line is too far from Y=0 (center layer), hide it? 
                // Or if line length is too long? (Can't know length in vert shader easily without extra attrs).
                // Let's treat LineDist as a "Vertical Focus" radius.
                if (abs(position.y) > uLineDist) {
                    vVisible = 0.0;
                }
                `
        );

        shader.fragmentShader = `
              uniform float uThinning;
              varying float vVisible;
            ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `
                if (vVisible < 0.1) discard;
                #include <color_fragment>
                
                // Thinning: Reduce Alpha
                // Slider 0 (Solid) -> 1 (Transparent/Thin)
                // If uThinning = 0, alpha = 0.2 (Original Legacy Value)
                // If uThinning = 1, alpha = 0.0
                diffuseColor.a = mix(0.2, 0.0, uThinning); 
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
