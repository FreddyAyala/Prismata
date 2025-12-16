import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

// Setup Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(2, 4, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// Lights
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x00ffff, 2, 20);
pointLight1.position.set(5, 5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xff00ff, 2, 20);
pointLight2.position.set(-5, 0, -5);
scene.add(pointLight2);

// Grid (Ground)
const gridHelper = new THREE.GridHelper(20, 20, 0x222222, 0x111111);
scene.add(gridHelper);

// Loader
const loader = new PLYLoader();
let currentMesh = null;

function loadPly(url) {
  if (currentMesh) {
    scene.remove(currentMesh);
    if (currentMesh.geometry) currentMesh.geometry.dispose();
    if (currentMesh.material) currentMesh.material.dispose();
  }

  document.getElementById('status').innerText = "Loading & Parsing Structure...";

  // 1. Load Geometry (Points)
  loader.load(url, (geometry) => {
    geometry.computeVertexNormals();

    // Create the Point Cloud
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      opacity: 0.8,
      transparent: true,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geometry, pointsMaterial);

    // 2. Load Edges (Lines) - Custom Parsing
    // We fetch the file again as text/buffer to read the edge indices manually
    // because THREE.PLYLoader doesn't expose the edge indices directly in the geometry.
    fetch(url).then(res => res.arrayBuffer()).then(buffer => {
      const data = new DataView(buffer);
      const decoder = new TextDecoder();
      let headerText = "";
      let offset = 0;

      // Read Header to find where data starts
      while (offset < buffer.byteLength) {
        const char = decoder.decode(buffer.slice(offset, offset + 1));
        headerText += char;
        offset++;
        if (headerText.endsWith("end_header\n")) break;
      }

      // Simple parsing to find edge count and start
      const lines = headerText.split('\n');
      let numVertices = 0;
      let numEdges = 0;

      lines.forEach(line => {
        if (line.startsWith("element vertex")) numVertices = parseInt(line.split(' ')[2]);
        if (line.startsWith("element edge")) numEdges = parseInt(line.split(' ')[2]);
      });

      if (numEdges > 0) {
        console.log(`Parsing ${numEdges} edges...`);
        // Calculate where edges start. 
        // We assume binary PLY or ASCII. The scripts creates ASCII by default now via `text=True`.
        // ASCII Parsing:
        const textContent = decoder.decode(buffer);
        const body = textContent.split("end_header\n")[1].trim().split('\n');

        // The body contains vertices first, then edges.
        // Edges lines look like: "index1 index2"

        const edgeIndices = [];
        // Skip vertices lines
        const edgeLines = body.slice(numVertices);

        edgeLines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            edgeIndices.push(parseInt(parts[0]), parseInt(parts[1]));
          }
        });

        if (edgeIndices.length > 0) {
          const lineGeometry = new THREE.BufferGeometry();
          // Copy position attribute from points
          lineGeometry.setAttribute('position', geometry.getAttribute('position'));
          lineGeometry.setIndex(edgeIndices);

          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            opacity: 0.15,
            transparent: true,
            blending: THREE.AdditiveBlending
          });

          const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);

          // Group Points + Lines
          const group = new THREE.Group();
          group.add(points);
          group.add(linesMesh);

          // Re-center
          geometry.computeBoundingBox();
          const center = geometry.boundingBox.getCenter(new THREE.Vector3());
          group.position.x = -center.x;
          group.position.y = -center.y;
          group.position.z = -center.z;

          scene.add(group);
          currentMesh = group;

          document.getElementById('status').innerText = `Crystal Active: ${numVertices} Nodes, ${numEdges} Links`;
        } else {
          // Fallback if parsing failed
          scene.add(points);
          currentMesh = points;
        }
      } else {
        scene.add(points);
        currentMesh = points;
      }
    });

  }, undefined, (error) => {
    console.error(error);
    document.getElementById('status').innerText = "Error loading file.";
  });
}

// Drag & Drop Handling
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#00ffff';
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#444';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = '#444';

  const file = e.dataTransfer.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    loadPly(url);
  }
});

// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
