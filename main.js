import * as THREE from 'three';

let camera, scene, renderer;

const startButton = document.getElementById('start-button');
startButton.addEventListener('click', init);

function init() {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';

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

    // Controls
    setupDeviceControls();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation
    animate();
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

function setupDeviceControls() {
    const deviceQuaternion = new THREE.Quaternion();
    const screenTransform = new THREE.Quaternion();
    const worldTransform = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 degrees around X-axis

    const onDeviceOrientation = (event) => {
        if (!event.alpha) return;

        const alpha = THREE.MathUtils.degToRad(event.alpha);
        const beta = THREE.MathUtils.degToRad(event.beta);
        const gamma = THREE.MathUtils.degToRad(event.gamma);
        const screenOrientation = THREE.MathUtils.degToRad(window.orientation || 0);

        const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
        deviceQuaternion.setFromEuler(euler);
        
        screenTransform.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenOrientation);
        
        // Combine transforms
        camera.quaternion.copy(worldTransform);
        camera.quaternion.multiply(deviceQuaternion);
        camera.quaternion.multiply(screenTransform);
    };

    const requestAndStart = () => {
        window.addEventListener('deviceorientation', onDeviceOrientation);
    };

    // Check for iOS 13+ permission API
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    requestAndStart();
                } else {
                    alert('Permission for device orientation not granted.');
                }
            })
            .catch(console.error);
    } else {
        // Handle non-iOS devices
        requestAndStart();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

