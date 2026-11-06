import DVD_Data from './DVD_Data.js'
import { useState } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function DVD_Model({Dvd_Data}){
    const DvdRef = useRef();
    const [isHovered, setIsHovered] = useState(false);

    const [animations, setAnimation] = useState(Dvd_Data.animations || []);

    function addAnimation(anim) {
        setAnimation(prev => [...prev, anim]);
    }

    useFrame((state, delta) => {
        //if there are animations
        if (animations && animations.length > 0) {
           
            if(animations[0].type === 'move') {
                const anim = animations[0];
                DvdRef.current.position.set(
                    anim.from.x + (anim.to.x - anim.from.x) * delta * anim.speed,
                    anim.from.y + (anim.to.y - anim.from.y) * delta * anim.speed,
                    anim.from.z + (anim.to.z - anim.from.z) * delta * anim.speed
                );
            }
        }
    });



    return(
        <mesh 
            ref={DvdRef} 
            position={[Dvd_Data.posX, Dvd_Data.posY, Dvd_Data.posZ]}
            onPointerOver={(event) => (event.stopPropagation(), 
                                        setIsHovered(true),
                                        addAnimation(
                                            {type: 'move', from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ}, to: {x: Dvd_Data.posX, y: Dvd_Data.posY + 1, z: Dvd_Data.posZ}, speed: 1}))}
            onPointerOut={(event) => (event.stopPropagation(), setIsHovered(false))}>

            {/* DVD case measured in inches: width x height x depth */}
            <boxGeometry args={[.55, 7.48, 5.31]}/>
            <meshStandardMaterial color={"white"}/>
        </mesh>
    )
}

export default DVD_Model;