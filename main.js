import * as THREE from 'three';

let camera, scene, renderer;
let isRunning = false;
let orientationSensor;
let deviceQuaternion = new THREE.Quaternion();
let calibrationQuaternion = new THREE.Quaternion();

const startButton = document.getElementById('start-button');
const infoText = document.querySelector('#info p');
const infoTitle = document.querySelector('#info h1');
const overlay = document.getElementById('overlay');

// World orientation
const worldTransform = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

startButton.addEventListener('click', handlePermissionRequest);

function handlePermissionRequest() {
    startButton.disabled = true;

    // --- Try new Sensor API first ---
    if ('AbsoluteOrientationSensor' in window) {
        Promise.all([
            navigator.permissions.query({ name: "accelerometer" }),
            navigator.permissions.query({ name: "magnetometer" }),
            navigator.permissions.query({ name: "gyroscope" }),
        ])
        .then((results) => {
            if (results.every((result) => result.state === "granted" || result.state === "prompt")) {
                initSensor();
            } else {
                infoText.textContent = "Sensor permissions are required. Please grant them and refresh.";
            }
        }).catch(err => {
            console.error("Sensor permissions error:", err);
            // Fallback to old API if new one fails for permission reasons
            tryDeviceOrientation();
        });
    } else {
        tryDeviceOrientation();
    }
}

function initSensor() {
    orientationSensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
    orientationSensor.addEventListener('reading', onSensorUpdate);
    orientationSensor.addEventListener('error', (event) => {
        console.error('Sensor error:', event.error.name, event.error.message);
        if (event.error.name === 'NotAllowedError') {
            infoText.textContent = "Permission to use sensors was denied.";
        } else {
             // Fallback if sensor fails for other reasons
            orientationSensor.stop();
            tryDeviceOrientation();
        }
    });

    orientationSensor.start();
    showCalibrationScreen();
}

function onSensorUpdate() {
    if (orientationSensor.quaternion) {
        deviceQuaternion.fromArray(orientationSensor.quaternion);
    }
}

function tryDeviceOrientation() {
    // Check for iOS 13+ permission API
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', onDeviceOrientation, true);
                    showCalibrationScreen();
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
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        showCalibrationScreen();
    }
}

function onDeviceOrientation(event) {
    if (!event.alpha) return;

    const alpha = THREE.MathUtils.degToRad(event.alpha); // yaw
    const beta = THREE.MathUtils.degToRad(event.beta);   // pitch
    const gamma = THREE.MathUtils.degToRad(event.gamma); // roll
    
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    deviceQuaternion.setFromEuler(euler);
}

function showCalibrationScreen() {
    infoTitle.textContent = "Calibrate Your View";
    infoText.textContent = "Point your phone in the desired 'forward' direction and press Start.";
    startButton.textContent = "Start";
    startButton.disabled = false;

    startButton.removeEventListener('click', handlePermissionRequest);
    startButton.addEventListener('click', calibrateAndStart, { once: true });
}

function calibrateAndStart() {
    // Capture the current orientation as the 'zero' point.
    calibrationQuaternion.copy(deviceQuaternion);
    startExperience();
}

function startExperience() {
    initScene();
    overlay.style.display = 'none';
    isRunning = true;
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
    // Correct for screen orientation
    const screenOrientation = THREE.MathUtils.degToRad(window.orientation || 0);
    const screenTransform = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenOrientation);

    // Get the inverse of the calibration quaternion
    const calibrationInverse = calibrationQuaternion.clone().invert();

    // Combine transforms:
    // 1. Start with world orientation.
    camera.quaternion.copy(worldTransform);
    // 2. Apply inverse of calibration rotation. This "resets" the view to forward.
    camera.quaternion.multiply(calibrationInverse);
    // 3. Apply current device orientation.
    camera.quaternion.multiply(deviceQuaternion);
    // 4. Adjust for screen rotation.
    camera.quaternion.multiply(screenTransform);
}

function onWindowResize() {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    if (!isRunning) return;
    requestAnimationFrame(animate);
    updateCameraOrientation();
    renderer.render(scene, camera);
}