"use client";

import { useRef, useState, Suspense, memo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Text } from "@react-three/drei";
import * as THREE from "three";
import { type TwinState } from "@/hooks/useSensorStream";

// ─── Farb-Mapping ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  ok:       "#10B981",
  warn:     "#F59E0B",
  critical: "#EF4444",
};

function statusColor(s: string) {
  return new THREE.Color(STATUS_COLOR[s] ?? "#10B981");
}

// ─── Glow-Material ────────────────────────────────────────────────────────────
function usePulseMaterial(status: string) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const pulse = status === "critical"
      ? 0.6 + Math.abs(Math.sin(t * 4)) * 0.8
      : status === "warn"
      ? 0.4 + Math.abs(Math.sin(t * 1.5)) * 0.3
      : 0.35;
    ref.current.emissiveIntensity = pulse;
    ref.current.color.lerp(statusColor(status), 0.06);
    ref.current.emissive.lerp(statusColor(status), 0.06);
  });

  return ref;
}

// ─── CNC-Basis / Tisch ────────────────────────────────────────────────────────
function MachineTable({ status }: { status: string }) {
  const mat = usePulseMaterial(status);
  return (
    <group position={[0, -0.6, 0]}>
      {/* Hauptrahmen */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.18, 2.2]} />
        <meshStandardMaterial
          ref={mat}
          color={statusColor(status)}
          emissive={statusColor(status)}
          emissiveIntensity={0.35}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      {/* Tisch-Gitter */}
      {[-1, -0.33, 0.33, 1].map((x) =>
        [-0.8, 0, 0.8].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.12, z]} castShadow>
            <boxGeometry args={[0.06, 0.12, 0.06]} />
            <meshStandardMaterial color="#0D0D1A" metalness={0.9} roughness={0.1} />
          </mesh>
        ))
      )}
      {/* Beine */}
      {[[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.45, z]} castShadow>
          <boxGeometry args={[0.15, 0.9, 0.15]} />
          <meshStandardMaterial color="#1E1E3A" metalness={0.9} roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Z-Achse / Spindel ────────────────────────────────────────────────────────
function Spindle({ status, anomaly }: { status: string; anomaly: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const spindleRef = useRef<THREE.Mesh>(null);
  const mat = usePulseMaterial(status);

  useFrame(({ clock }) => {
    if (!groupRef.current || !spindleRef.current) return;
    const t = clock.getElapsedTime();

    // Leichte vertikale Bewegung (Z-Achse fährt auf und ab)
    groupRef.current.position.y = 0.5 + Math.sin(t * 0.7) * 0.12;

    // Spindel dreht sich
    spindleRef.current.rotation.y = t * 8;

    // Vibrations-Shake bei Anomalie
    if (anomaly) {
      groupRef.current.position.x = Math.sin(t * 40) * 0.015;
      groupRef.current.position.z = Math.cos(t * 37) * 0.015;
    } else {
      groupRef.current.position.x = 0;
      groupRef.current.position.z = 0;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Z-Achsen-Schlitten */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.7, 0.4]} />
        <meshStandardMaterial color="#12121F" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Spindelkopf */}
      <mesh ref={spindleRef} position={[0, -0.55, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.45, 16]} />
        <meshStandardMaterial
          ref={mat}
          color={statusColor(status)}
          emissive={statusColor(status)}
          emissiveIntensity={0.4}
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>

      {/* Werkzeug-Bit */}
      <mesh position={[0, -0.85, 0]} castShadow>
        <coneGeometry args={[0.04, 0.2, 8]} />
        <meshStandardMaterial color="#64748B" metalness={1} roughness={0.05} />
      </mesh>

      {/* Label */}
      <Text
        position={[0.4, 0.2, 0]}
        fontSize={0.09}
        color={STATUS_COLOR[status]}
        anchorX="left"
        font="/fonts/inter.woff"
      >
        SPINDEL
      </Text>
    </group>
  );
}

// ─── Motor-Gehäuse ────────────────────────────────────────────────────────────
function Motor({ status }: { status: string }) {
  const mat = usePulseMaterial(status);
  const fanRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (fanRef.current) fanRef.current.rotation.z = clock.getElapsedTime() * 5;
  });

  return (
    <group position={[0, 0.7, 0]}>
      {/* Motorblock */}
      <mesh castShadow>
        <boxGeometry args={[0.65, 0.55, 0.55]} />
        <meshStandardMaterial
          ref={mat}
          color={statusColor(status)}
          emissive={statusColor(status)}
          emissiveIntensity={0.35}
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>
      {/* Kühlrippen */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((z) => (
        <mesh key={z} position={[0.35, 0, z]} castShadow>
          <boxGeometry args={[0.04, 0.45, 0.04]} />
          <meshStandardMaterial color="#1E1E3A" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Lüfter */}
      <mesh ref={fanRef} position={[-0.36, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.15, 0.025, 4, 6]} />
        <meshStandardMaterial color="#06B6D4" metalness={0.8} roughness={0.2} emissive="#06B6D4" emissiveIntensity={0.3} />
      </mesh>

      <Text
        position={[-0.6, 0.35, 0]}
        fontSize={0.09}
        color={STATUS_COLOR[status]}
        anchorX="right"
        font="/fonts/inter.woff"
      >
        MOTOR
      </Text>
    </group>
  );
}

// ─── X-Achse (Portal-Brücke) ─────────────────────────────────────────────────
function XAxis() {
  const slittenRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (slittenRef.current) {
      slittenRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.4) * 1.0;
    }
  });

  return (
    <group position={[0, 0.05, 0]}>
      {/* Führungsschiene */}
      <mesh castShadow>
        <boxGeometry args={[3.0, 0.12, 0.12]} />
        <meshStandardMaterial color="#1E1E3A" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Schlitten */}
      <mesh ref={slittenRef} position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.28]} />
        <meshStandardMaterial color="#12121F" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ─── Kühlmittel-System ────────────────────────────────────────────────────────
function CoolantSystem({ status }: { status: string }) {
  const mat = usePulseMaterial(status);
  return (
    <group position={[1.35, -0.3, 0.7]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.55, 12]} />
        <meshStandardMaterial
          ref={mat}
          color={statusColor(status)}
          emissive={statusColor(status)}
          emissiveIntensity={0.3}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <Text
        position={[0, 0.45, 0]}
        fontSize={0.08}
        color={STATUS_COLOR[status]}
        anchorX="center"
        font="/fonts/inter.woff"
      >
        KÜHLM.
      </Text>
    </group>
  );
}

// ─── Umgebendes Gestell ───────────────────────────────────────────────────────
function Frame({ status }: { status: string }) {
  const edgeColor = status === "ok" ? "#1E1E3A" : STATUS_COLOR[status];
  return (
    <group>
      {/* 4 vertikale Säulen */}
      {[[-1.5, -1.0], [1.5, -1.0], [-1.5, 1.0], [1.5, 1.0]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]}>
          <boxGeometry args={[0.07, 2.2, 0.07]} />
          <meshStandardMaterial color={edgeColor} metalness={0.95} roughness={0.05} emissive={edgeColor} emissiveIntensity={0.1} />
        </mesh>
      ))}
      {/* Obere Querträger */}
      {[[-1.0, 1.3], [1.0, 1.3]].map(([z, y], i) => (
        <mesh key={i} position={[0, y, z]}>
          <boxGeometry args={[3.1, 0.07, 0.07]} />
          <meshStandardMaterial color={edgeColor} metalness={0.95} roughness={0.05} emissive={edgeColor} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Boden-Gitter ─────────────────────────────────────────────────────────────
function GridFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]} receiveShadow>
      <planeGeometry args={[12, 12, 20, 20]} />
      <meshStandardMaterial
        color="#0D0D1A"
        metalness={0.1}
        roughness={0.9}
        wireframe
        transparent
        opacity={0.25}
      />
    </mesh>
  );
}

// ─── Komplette Maschine ───────────────────────────────────────────────────────
function CNCMachine({ twinState, anomaly }: { twinState: TwinState; anomaly: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Sanfte Auto-Rotation
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.08) * 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      <Frame  status={twinState.frame} />
      <MachineTable status={twinState.table} />
      <XAxis />
      <Spindle  status={twinState.spindle} anomaly={anomaly} />
      <Motor    status={twinState.motor} />
      <CoolantSystem status={twinState.coolant} />
      <GridFloor />
    </group>
  );
}

// ─── Partikelsystem (Anomalie) ────────────────────────────────────────────────
function AnomalyParticles({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 60;

  const positions = new Float32Array(count * 3).map(() => (Math.random() - 0.5) * 2);

  useFrame(({ clock }) => {
    if (!ref.current || !active) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.5;
    ref.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    (ref.current.material as THREE.PointsMaterial).opacity =
      0.3 + Math.abs(Math.sin(t * 3)) * 0.5;
  });

  if (!active) return null;
  return (
    <points ref={ref} position={[0, 0.3, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#EF4444"
        size={0.04}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

const DEFAULT_TWIN: TwinState = {
  spindle: "ok", motor: "ok", coolant: "ok", frame: "ok", table: "ok",
};

interface DigitalTwinProps {
  twinState?: TwinState;
  anomaly?: boolean;
}

export const DigitalTwin = memo(function DigitalTwin({ twinState = DEFAULT_TWIN, anomaly = false }: DigitalTwinProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="glass-card overflow-hidden relative" style={{ height: "100%", minHeight: 340, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between border-b border-[#1E1E3A] bg-[#050508]/60 backdrop-blur-sm">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
          Digital Twin — CNC-Fräse Alpha
        </span>
        <div className="flex items-center gap-3">
          {anomaly && (
            <span className="text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-2 py-0.5 rounded-full animate-pulse">
              ANOMALIE
            </span>
          )}
          <span className="text-[10px] font-mono text-[#64748B]">3D LIVE</span>
        </div>
      </div>

      {/* Status-Legende */}
      <div className="absolute bottom-3 left-4 z-10 flex flex-col gap-1.5">
        {Object.entries(twinState).map(([part, status]) => (
          <div key={part} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[status], boxShadow: `0 0 6px ${STATUS_COLOR[status]}` }}
            />
            <span className="text-[10px] font-mono text-[#64748B] uppercase">{part}</span>
          </div>
        ))}
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [4, 3, 5], fov: 45 }}
        shadows
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%", display: "block", background: "#050508" }}
      >
        <fog attach="fog" args={["#050508", 12, 25]} />

        <ambientLight intensity={0.3} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 2, -3]} intensity={0.5} color="#6366F1" />
        <pointLight position={[3, 1, 3]}  intensity={0.3} color="#06B6D4" />

        <Suspense fallback={null}>
          <Float speed={0.6} rotationIntensity={0} floatIntensity={0.15}>
            <CNCMachine twinState={twinState} anomaly={anomaly} />
          </Float>
          <AnomalyParticles active={anomaly} />
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={hovered}
          minDistance={3}
          maxDistance={12}
          autoRotate={!hovered}
          autoRotateSpeed={0.4}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 6}
        />
      </Canvas>
    </div>
  );
});
