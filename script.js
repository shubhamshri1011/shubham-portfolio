/**
 * @file Main script for the personal portfolio website.
 * @author Shubham Shrivastava
 * @version 1.0.0
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const themeSwitch = document.getElementById('checkbox');
    const body = document.body;
    const hamburger = document.getElementById('hamburger-menu');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const themeStatus = document.getElementById('theme-status');

    // --- Mobile Navigation Logic ---
    /**
     * Toggles the mobile navigation menu open and closed.
     * Also toggles the hamburger icon between 'bars' and 'times'.
     */
    function toggleMobileMenu() {
        navMenu.classList.toggle('active');
        const isMenuOpen = navMenu.classList.contains('active');
        hamburger.setAttribute('aria-expanded', isMenuOpen);
        const icon = hamburger.querySelector('i');
        icon.classList.toggle('fa-bars', !isMenuOpen);
        icon.classList.toggle('fa-times', isMenuOpen);
    }

    hamburger.addEventListener('click', toggleMobileMenu);

    // Close mobile menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                toggleMobileMenu();
            }
        });
    });

    // --- Three.js Starfield ---
    let scene, camera, renderer, stars, starMaterial;
    let mouseX = 0;
    let mouseY = 0;

    // --- Theme Management ---
    /**
     * Applies the selected theme (light/dark) to the body and updates the 3D background.
     * @param {string} theme - The theme to apply ('light' or 'dark').
     */
    const applyTheme = (theme) => {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(`${theme}-mode`);
        themeSwitch.checked = (theme === 'dark');

        // Update star color if the 3D material has been initialized
        if (starMaterial) {
            const starColor = getComputedStyle(body).getPropertyValue(`--star-color-${theme}`);
            starMaterial.color.set(starColor);
        }

        // Update screen reader status
        if (themeStatus) {
            themeStatus.textContent = `${theme.charAt(0).toUpperCase() + theme.slice(1)} theme enabled`;
        }
    };
    
    // Load saved theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    // Event listener for the theme toggle switch
    themeSwitch.addEventListener('change', () => {
        const newTheme = themeSwitch.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- Scroll Reveal Animation ---
    /**
     * Uses IntersectionObserver to add a 'visible' class to elements as they enter the viewport.
     */
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    // --- Starfield Initialization & Animation ---
    /**
     * Initializes the Three.js scene, camera, renderer, and starfield particles.
     */
    function initStarfield() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        camera.position.z = 1;

        renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('bg-canvas'),
            alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Determine particle count based on screen size for performance
        const starCount = window.innerWidth < 768 ? 5000 : 10000;
        const positions = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 100;
            positions[i3 + 1] = (Math.random() - 0.5) * 100;
            positions[i3 + 2] = (Math.random() - 0.5) * 100;
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const initialStarColor = getComputedStyle(body).getPropertyValue(body.classList.contains('dark-mode') ? '--star-color-dark' : '--star-color-light');
        starMaterial = new THREE.PointsMaterial({
            color: initialStarColor,
            size: 0.05,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8
        });

        stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        document.addEventListener('mousemove', onMouseMove, false);
        window.addEventListener('resize', onWindowResize, false);
        
        animate();
    }

    /**
     * Handles mouse movement to update coordinates for camera interaction.
     * @param {MouseEvent} event - The mouse move event.
     */
    function onMouseMove(event) {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    /**
     * Handles window resize events to keep the 3D scene responsive.
     */
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    const clock = new THREE.Clock();
    /**
     * The main animation loop, called on every frame.
     */
    function animate() {
        const elapsedTime = clock.getElapsedTime();
        
        // Slow constant rotation
        if (stars) {
            stars.rotation.y = elapsedTime * 0.01;
        }

        // Interactively move camera based on mouse position
        // Use a small factor for subtle, smooth movement (lerping)
        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    // Initialize the starfield
    initStarfield();
});
