import { Canvas, useFrame } from "@react-three/fiber"
import { DirectionalLightHelper } from "three"
import DVD_Model from './DVD_Model.jsx'
import DVD_Data from './DVD_Data.js'
import ShelfRow from './ShelfRow.jsx'
import { OrbitControls} from "@react-three/drei"

function VirtualShelfRender({ dvds, shelfData }){
    /*
    //helper func stuff, used for debug, displays light in render
  const directionalLightRef = useRef()
  useHelper(directionalLightRef, DirectionalLightHelper, 0.5, "black" )
  add ref={directionalLightRef} to directionalLight later

    */
    
    return(
        <Canvas>
            <directionalLight position={[0, 6, 0]}/>
            <ambientLight intensity={0.9}/>
            {/* Render DVDs */}
            {dvds.map((dvd) => (
                <DVD_Model key={dvd.id} Dvd_Data={dvd}/>
            ))}

            {/* Render shelf rows */}
            {Array.from({ length: shelfData.numOfShelves }).map((_, index) => (
                <ShelfRow key={index} posX={0} posY={-index * shelfData.length} posZ={0} width={shelfData.width} length={shelfData.length} thin={shelfData.thin}/>
            ))}
            <OrbitControls />
        </Canvas>
    )
}

export default VirtualShelfRender;