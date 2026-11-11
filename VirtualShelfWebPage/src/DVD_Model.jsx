import { useState, useEffect } from 'react'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'

function DVD_Model({Dvd_Data, pulledOutDVDId, setPulledOutDVDId}){
    // Reference to the DVD mesh, mainly used for keeping track of its CURRENT location, not its shelf location
    const DvdRef = useRef();
    const [isHovered, setIsHovered] = useState(false);

    //used for the "pulled out slightly animation" or "pop in/pop out"
    const [poppedOut, setPoppedOut] = useState(false);
    const popOutAnimation = {
        type: 'move',
        desc: 'popOut',
        from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 1},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 3
    };
    const popInAnimation = {
        type: 'move',
        desc: 'popIn',
        from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 1},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 1.5
    };

    //used for the fully pulled out/ pushed back in animations
    const pulledOut = pulledOutDVDId === Dvd_Data.id;
    const rotationRef = useRef({angleX: 0, angleY: 0, deltaX: 0, deltaY: 0});
    const [rotateDVD, setRotateDVD] = useState(false);
    
    const pulledOutAnimations = [{   
        type: 'move',
        desc: 'pulledOut',
        from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 2.0
    },
    {   
        type: 'move',
        desc: 'pulledOutFinish',
        from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: 0, y: Dvd_Data.posY, z: Dvd_Data.posZ + 10},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 5.0
    }];
    const pushedInAnimations = [{   
        type: 'move',
        desc: 'pushedIn',
        from: {x: 0, y: Dvd_Data.posY, z: Dvd_Data.posZ + 10},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 5.0
    },
    {   
        type: 'move',
        desc: 'pushedInFinish',
        from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
        fromRot: {rotX: 0, rotY: 0, rotZ: 0},
        to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ},
        toRot: {rotX: 0, rotY: 0, rotZ: 0},
        speed: 2.0
    }];



    const [animations, setAnimation] = useState(Dvd_Data.animations || []);
    const animationElapsedRef = useRef(0);

    function addAnimation(anim) {
        setAnimation(a => [...a, anim]);
    }
    function addAnimations(anims){
        setAnimation(a => [...a, ...anims]);
    }

    function getPushedInAnimations() {
        return [{   
            type: 'move',
            desc: 'pushedIn',
            from: {x: 0, y: Dvd_Data.posY, z: Dvd_Data.posZ + 10},
            fromRot: {rotX: DvdRef.current.rotation.x, rotY: DvdRef.current.rotation.y, rotZ: DvdRef.current.rotation.z},
            to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
            toRot: {rotX: 0, rotY: 0, rotZ: 0},
            speed: 5.0
        },
        {   
            type: 'move',
            desc: 'pushedInFinish',
            from: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ + 5},
            fromRot: {rotX: 0, rotY: 0, rotZ: 0},
            to: {x: Dvd_Data.posX, y: Dvd_Data.posY, z: Dvd_Data.posZ},
            toRot: {rotX: 0, rotY: 0, rotZ: 0}, 
            speed: 2.0
        }];
    }

    function resetRotation() {
        rotationRef.current.angleX = 0;
        rotationRef.current.angleY = 0;
        rotationRef.current.deltaX = 0;
        rotationRef.current.deltaY = 0;
    }

    // Reset poppedOut state when DVD is no longer pulled out
    useEffect(() => {
        if (!pulledOut) {
            setPoppedOut(false);
        }
    }, [pulledOut]);

    //animate the current animation
    useFrame((state, delta) => {
        let anim = null;

        //if there are animations/set an animation
        if (animations && animations.length > 0) { 
           anim = animations[0];
        }
        //used for user rotation of DVD - pauses all other animations when rotating
        else if(pulledOut && rotateDVD) {
            const rotationSpeed = 0.01;
            rotationRef.current.angleX += rotationRef.current.deltaX * rotationSpeed;
            rotationRef.current.angleY += rotationRef.current.deltaY * rotationSpeed;

            //adjust for negative radians and wrap angles between 0 and 2PI
            const TWO_PI = 2 * Math.PI;
            rotationRef.current.angleX = (rotationRef.current.angleX % TWO_PI + TWO_PI) % TWO_PI;
            rotationRef.current.angleY = (rotationRef.current.angleY % TWO_PI + TWO_PI) % TWO_PI;
            
            //rotationRef X and Y need to be flipped in order for the dvd to rotate the way the user expects
            DvdRef.current.rotation.set(
                rotationRef.current.angleY,
                rotationRef.current.angleX,
                DvdRef.current.rotation.z
            );
            
            rotationRef.current.deltaX = 0;
            rotationRef.current.deltaY = 0;
            return;
        }
        //DVD is paused and ready for rotation, but user is not currently rotating
        else if(pulledOut) {
            return;
        }
        else if(isHovered) {
            anim = popOutAnimation;
        }
        else if(poppedOut) {
            anim = popInAnimation;
        }
        else {
            return;
        }
        //Animation control: determine which animation to play
        let progress = 0;

        //used for simple linear and rotational animations
        if(anim.type === 'move') {
            animationElapsedRef.current += delta * anim.speed;
            
            const distance = Math.sqrt(
                Math.pow(anim.to.x - anim.from.x, 2) +
                Math.pow(anim.to.y - anim.from.y, 2) +
                Math.pow(anim.to.z - anim.from.z, 2)
            );
            console.log("From rotX: " + anim.fromRot.rotX + " From rotY: " + anim.fromRot.rotY + " From rotZ: " + anim.fromRot.rotZ )
            console.log("To rotX: " + anim.toRot.rotX + " To rotY: " + anim.toRot.rotY + " To rotZ: " + anim.toRot.rotZ )

            // Calculate signed rotation differences
            let xRotDiff = anim.toRot.rotX - anim.fromRot.rotX;
            let yRotDiff = anim.toRot.rotY - anim.fromRot.rotY;
            let zRotDiff = anim.toRot.rotZ - anim.fromRot.rotZ;

            // Normalize to shortest path (keep between -PI and PI)
            const TWO_PI = 2 * Math.PI;
            if (xRotDiff > Math.PI) xRotDiff -= TWO_PI;
            if (xRotDiff < -Math.PI) xRotDiff += TWO_PI;
            if (yRotDiff > Math.PI) yRotDiff -= TWO_PI;
            if (yRotDiff < -Math.PI) yRotDiff += TWO_PI;
            if (zRotDiff > Math.PI) zRotDiff -= TWO_PI;
            if (zRotDiff < -Math.PI) zRotDiff += TWO_PI;

            const rotDistance = Math.abs(xRotDiff) + Math.abs(yRotDiff) + Math.abs(zRotDiff);

            const duration = distance + rotDistance > 0 ? distance + rotDistance : 1;
            progress = Math.min(animationElapsedRef.current / (duration + rotDistance), 1);

            //animate
            DvdRef.current.position.set(
                anim.from.x + (anim.to.x - anim.from.x) * progress,
                anim.from.y + (anim.to.y - anim.from.y) * progress,
                anim.from.z + (anim.to.z - anim.from.z) * progress
            );

            //interpolate rotation along the shortest path
            DvdRef.current.rotation.set(
                anim.fromRot.rotX + xRotDiff * progress,
                anim.fromRot.rotY + yRotDiff * progress,
                anim.fromRot.rotZ + zRotDiff * progress
            );
        }

        //check if animation is complete
        if (progress >= 1) {
            //snap to the final position
            DvdRef.current.position.set(anim.to.x, anim.to.y, anim.to.z);
            DvdRef.current.rotation.set(anim.toRot.rotX, anim.toRot.rotY, anim.toRot.rotZ);

            //check for pop in/out animations, 
            if(anim.desc === 'popOut'){
                //Note: Specifically, do not reset animationElapsedRef if the popout animation has finished BUT the cursor is still hovering over it.
                //if the DVD is not hovered, reset the animation elapsed time for next animation
                if(!isHovered){
                    animationElapsedRef.current = 0;
                }
                return;
            }
            else if(anim.desc === 'popIn'){
                //if the pop in/out animation has finished, set bool to indicate
                setPoppedOut(false);
                animationElapsedRef.current = 0;
                return;
            }
            else if(anim.desc === 'pulledOutFinish'){
                animationElapsedRef.current = 0;
                //DVD is now paused and ready for rotation
                setAnimation(prev => prev.slice(1));
                return;
            }
            else if(anim.desc === 'pushedInFinish'){
                animationElapsedRef.current = 0;
                //DVD has been pushed back in
                setAnimation(prev => prev.slice(1));
                return;
            }

            //used for animations that do not require a work on finish
            //remove the completed animation
            setAnimation(prev => prev.slice(1));
            animationElapsedRef.current = 0;
        }
        
    });




    return(
        <mesh 
            ref={DvdRef} 
            position={[Dvd_Data.posX, Dvd_Data.posY, Dvd_Data.posZ]}
            onPointerOver={(event) => {
                                        event.stopPropagation();
                                        if (!pulledOut) {
                                            setPoppedOut(true);
                                            setIsHovered(true);
                                        }
                                    }}

            onPointerOut={(event) =>  { 
                                        event.stopPropagation();
                                        if (!pulledOut) {
                                            setIsHovered(false);
                                        }
                                    }}

            onClick={(event) => {
                                event.stopPropagation();
                                if (pulledOut) {
                                    setPulledOutDVDId(null);
                                    setRotateDVD(false);
                                    addAnimations(getPushedInAnimations());
                                } else {
                                    setPulledOutDVDId(Dvd_Data.id);
                                    addAnimations(pulledOutAnimations);
                                }
                            }}
            
            onPointerDown={(event) => ( event.stopPropagation(),
                                        setRotateDVD(true), 
                                        event.target.setPointerCapture(event.pointerId))}
            
            onPointerUp={(event) => ( event.stopPropagation(),
                                      setRotateDVD(false),
                                      event.target.releasePointerCapture(event.pointerId))}
            
            onPointerMove={(event) => {
                                    event.stopPropagation();
                                    if(rotateDVD){
                                        rotationRef.current.deltaX += event.movementX;
                                        rotationRef.current.deltaY += event.movementY;
                                    }
            }}
            >


            {/* DVD case measured in inches: width x height x depth */}
            <boxGeometry args={[.55, 7.48, 5.31]}/>
            <meshStandardMaterial color={"white"}/>
        </mesh>
    )
}

export default DVD_Model;