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

    // --- POINTS ---
    const pointMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    // Inject Pulse Logic (Matches original Safe State)
    pointMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = customUniforms.uTime;
      shader.uniforms.uPulseEnabled = customUniforms.uPulseEnabled;

      shader.vertexShader = `
          varying float vPulse;
          uniform float uTime;
          uniform float uPulseEnabled;
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
          #include <worldpos_vertex>
          vPulse = 0.0;
          if (uPulseEnabled > 0.5) {
             float offset = sin(position.x * 0.5) + cos(position.y * 0.5);
             float wave = sin(position.z * 0.2 + uTime * 2.5 + offset * 0.5);
             vPulse = smoothstep(0.9, 1.0, wave);
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

    // --- SIMPLE LINES (Matches original Safe State) ---
    if (edgeIndices.length > 0) {
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', geometry.getAttribute('position'));
      lineGeometry.setIndex(edgeIndices);

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending
      });
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
