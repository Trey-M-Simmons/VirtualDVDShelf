import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useLayoutEffect, useRef, useState } from 'react'
import { DirectionalLightHelper } from "three"
import DVD_Model from './DVD_Model.jsx'
import DVD_Data from './DVD_Data.js'
import ShelfRow from './ShelfRow.jsx'
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { shelfCameraDistance, shelfScrollBounds } from './shelfCamera.js'

function FitShelfCamera({ shelfData, cameraY }) {
    const size = useThree(state => state.size);
    const distance = shelfCameraDistance(size.width, size.height, shelfData);
    return <PerspectiveCamera makeDefault position={[0, cameraY, distance]} fov={50} near={0.1} far={1000} />;
}

function VirtualShelfRender({ dvds, setDvds, shelfData, pulledOutDVDId, setPulledOutDVDId, onDVDClick }){
    const scrollRef = useRef(null);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [scrollTop, setScrollTop] = useState(0);

    useLayoutEffect(() => {
        const element = scrollRef.current;
        const observer = new ResizeObserver(() => {
            setViewport({ width: element.clientWidth, height: element.clientHeight });
        });
        observer.observe(element);
        setViewport({ width: element.clientWidth, height: element.clientHeight });
        return () => observer.disconnect();
    }, []);

    const bounds = shelfScrollBounds(viewport.width, viewport.height, shelfData);
    const progress = bounds.scrollHeight > 0 ? Math.min(scrollTop / bounds.scrollHeight, 1) : 0;
    const cameraY = bounds.top + (bounds.bottom - bounds.top) * progress;
    /*
    //helper func stuff, used for debug, displays light in render
  const directionalLightRef = useRef()
  useHelper(directionalLightRef, DirectionalLightHelper, 0.5, "black" )
  add ref={directionalLightRef} to directionalLight later

    */
    
    return(
        <div className="shelf-scroll" ref={scrollRef} onScroll={event => setScrollTop(event.currentTarget.scrollTop)} tabIndex={0} role="region" aria-label="Scroll through DVD shelves">
        <div className="shelf-canvas">
        <Canvas camera={{ 
                        position: [0, 0, 30],
                        fov: 50,
                        near: 0.1, //clipping
                        far: 1000
                        }}>
            <FitShelfCamera shelfData={shelfData} cameraY={cameraY} />
            <directionalLight position={[0, 6, 0]}/>
            <ambientLight intensity={0.9}/>
            {/* Render DVDs */}
            {dvds.map((dvd) => (
                <DVD_Model key={dvd.id} Dvd_Data={dvd} setDvds={setDvds} pulledOutDVDId={pulledOutDVDId} setPulledOutDVDId={setPulledOutDVDId} onDVDClick={onDVDClick}/>
            ))}

            {/* Render shelf rows */}
            {Array.from({ length: shelfData.numOfShelves }).map((_, index) => (
                <ShelfRow key={index} posX={0} posY={-index * shelfData.height} posZ={0} width={shelfData.width} height={shelfData.height} depth={shelfData.depth} thin={shelfData.thin}/>
            ))}
            {/* <OrbitControls /> */}
        </Canvas>
        </div>
        <div aria-hidden="true" style={{ height: bounds.scrollHeight }} />
        </div>
    )
}

export default VirtualShelfRender;