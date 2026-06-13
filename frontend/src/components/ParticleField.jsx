// Holographic particle backdrop (FR-25) using Three.js.
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ParticleField() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 60;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const COUNT = 900;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 3; i++) positions[i] = (Math.random() - 0.5) * 140;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x00d4ff, size: 0.6, transparent: true, opacity: 0.55 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let raf;
    const animate = () => {
      points.rotation.y += 0.0006;
      points.rotation.x += 0.0002;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      if (renderer.domElement.parentNode) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="particle-field" />;
}
