import { Canvas, useFrame } from "@react-three/fiber"
import { DirectionalLightHelper } from "three"
import DVD_Model from './DVD_Model.jsx'
import DVD_Data from './DVD_Data.js'
import ShelfRow from './ShelfRow.jsx'
import { OrbitControls} from "@react-three/drei"

function VirtualShelfRender({ dvds, shelfData, pulledOutDVDId, setPulledOutDVDId }){
    /*
    //helper func stuff, used for debug, displays light in render
  const directionalLightRef = useRef()
  useHelper(directionalLightRef, DirectionalLightHelper, 0.5, "black" )
  add ref={directionalLightRef} to directionalLight later

    */
    
    return(
        <Canvas camera={{ 
                        position: [0, 0, 30],
                        fov: 50,
                        near: 0.1, //clipping
                        far: 1000
                        }}>
            <directionalLight position={[0, 6, 0]}/>
            <ambientLight intensity={0.9}/>
            {/* Render DVDs */}
            {dvds.map((dvd) => (
                <DVD_Model key={dvd.id} Dvd_Data={dvd} pulledOutDVDId={pulledOutDVDId} setPulledOutDVDId={setPulledOutDVDId}/>
            ))}

            {/* Render shelf rows */}
            {Array.from({ length: shelfData.numOfShelves }).map((_, index) => (
                <ShelfRow key={index} posX={0} posY={-index * shelfData.height} posZ={0} width={shelfData.width} height={shelfData.height} depth={shelfData.depth} thin={shelfData.thin}/>
            ))}
            {/* <OrbitControls /> */}
        </Canvas>
    )
}

export default VirtualShelfRender;