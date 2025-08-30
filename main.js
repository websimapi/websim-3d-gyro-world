import * as THREE from 'three';

let camera, scene, renderer;
let calibrationQuaternion = new THREE.Quaternion();
let isCalibrated = false;

const startButton = document.getElementById('start-button');
const infoText = document.querySelector('#info p');
const infoHeader = document.querySelector('#info h1');
const calibrationHelper = document.getElementById('calibration-helper');
const overlay = document.getElementById('overlay');

const deviceQuaternion = new THREE.Quaternion();

startButton.addEventListener('click', handlePermissionRequest);

function handlePermissionRequest() {
    // Check for iOS 13+ permission API
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    setupSceneAndCalibration();
                } else {
                    infoText.textContent = 'Permission for device orientation was denied. Please refresh and try again.';
                    startButton.disabled = true;
                }
            })
            .catch((error) => {
                infoText.textContent = `An error occurred: ${error.message}`;
                console.error(error);
            });
    } else {
        // Handle non-iOS devices that don't need explicit permission
        setupSceneAndCalibration();
    }
}

function setupSceneAndCalibration() {
    initScene();
    
    // Update UI for calibration step
    infoHeader.textContent = 'Calibration';
    infoText.textContent = 'Ready to calibrate.';
    calibrationHelper.style.display = 'block';
    startButton.textContent = 'Calibrate';
    startButton.disabled = false;
    
    // Remove previous listener and add new one for calibration
    startButton.removeEventListener('click', handlePermissionRequest);
    startButton.addEventListener('click', calibrateAndStart);

    // Start listening to device orientation to capture data for calibration
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
}

function onDeviceOrientation(event) {
    if (!event.alpha) return;

    const alpha = THREE.MathUtils.degToRad(event.alpha);
    const beta = THREE.MathUtils.degToRad(event.beta);
    const gamma = THREE.MathUtils.degToRad(event.gamma);
    
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    deviceQuaternion.setFromEuler(euler);
}

function calibrateAndStart() {
    // The device should be flat, so its current orientation is our baseline.
    // The screen transform will be applied later, so we just need the raw device quaternion.
    calibrationQuaternion.copy(deviceQuaternion).invert();
    isCalibrated = true;

    // Hide overlay and start the experience
    overlay.style.display = 'none';
    animate();
}

function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 1, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0); // Approx eye-level

    // Renderer
    const canvas = document.querySelector('#c');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 5);
    scene.add(directionalLight);

    // World content
    createWorld();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function createWorld() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Objects
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 50; i++) {
        const boxMaterial = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(
            (Math.random() - 0.5) * 100,
            (Math.random() * 10) + 0.5,
            (Math.random() - 0.5) * 100
        );
        box.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        scene.add(box);
    }
}

function updateCameraOrientation() {
    const screenTransform = new THREE.Quaternion();
    const worldTransform = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 degrees around X-axis
    const screenOrientation = THREE.MathUtils.degToRad(window.orientation || 0);

    screenTransform.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenOrientation);

    // Combine transforms
    camera.quaternion.copy(worldTransform);
    // Apply calibration rotation
    camera.quaternion.multiply(calibrationQuaternion);
    // Apply current device rotation
    camera.quaternion.multiply(deviceQuaternion);
    // Apply screen orientation
    camera.quaternion.multiply(screenTransform);
}

function onWindowResize() {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if(isCalibrated) {
        updateCameraOrientation();
    }
    renderer.render(scene, camera);
}