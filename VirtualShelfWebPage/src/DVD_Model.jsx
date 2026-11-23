import { useState, useEffect } from 'react'
import { useRef } from 'react'
import { useGLTF, useAnimations, Decal } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { LoopOnce } from 'three'

const gltfDirect = './../models/GenericDVD.gltf';

// Changing from an untextured material to a texture requires a new shader.
function updateTextureMaterial(material) {
    material.needsUpdate = true;
}

function DVD_Model({Dvd_Data, pulledOutDVDId, setPulledOutDVDId, onDVDClick}){
    // Reference to the DVD mesh, mainly used for keeping track of its CURRENT location, not its shelf location
    const DvdRef = useRef();

    //DVD models and animations Load
    const { nodes, materials, animations } = useGLTF(gltfDirect)
    const { actions, mixer } = useAnimations(animations, DvdRef)

    //list of animations for the DVD to do
    const [pendingAnimations, setAnimation] = useState(Dvd_Data.animations || []);
    const animationElapsedRef = useRef(0);//keeps track of how much time has elapsed for the current animation, helps with smooth transitions.
    
    //adder funcs
    function addAnimation(anim) {
        setAnimation(a => [...a, anim]);
    }
    function addAnimations(anims){
        setAnimation(a => [...a, ...anims]);
    }

    //resets DVD rot, mainly used to clean up after animations 
    function resetRotation() {
        rotationRef.current.angleX = 0;
        rotationRef.current.angleY = 0;
        rotationRef.current.deltaX = 0;
        rotationRef.current.deltaY = 0;
    }


    // used to "pop" the dvd out of the shelf
    const [isHovered, setIsHovered] = useState(false);

    //used for the open animation
    const [isOpen, setIsOpen] = useState(false);//determines if the DVD is currently open/opening
    const [toBeOpen, setToBeOpen] = useState(false); //determines if the DVD is or should be open

    //used to distinguish click vs double-click
    const clickTimeoutRef = useRef(null);
    
    //track if we should push back in after closing
    //used mainly when a user single clicks on a pulled out and open DVD to push it back in after closing it
    const shouldPushBackAfterClosingRef = useRef(false);

    //Play opening/closing animation
    useEffect(() => {
        //I am terrible at blender, these animations break stuff
        const excludedAnimations = ['dvd_caseAction.003', 'dvd_case.001Action'];
        
        //play the opening animation (if the DVD should be open and isn't already)
        if(toBeOpen && !isOpen && pulledOut.current){
            setIsOpen(true);
            const clips = Object.values(actions)
                .filter(Boolean)
                .filter(action => !excludedAnimations.includes(action.getClip().name));
            clips.forEach((action) => {
                action.loop = LoopOnce;
                action.clampWhenFinished = true;
                action.timeScale = 1;
                action.reset().play();
            });
        }
        //play the closing animation(just the opening animation in reverse)
        else if(!toBeOpen && isOpen && pulledOut.current){
            setIsOpen(false);
            const clips = Object.values(actions)
                .filter(Boolean)
                .filter(action => !excludedAnimations.includes(action.getClip().name));
            clips.forEach((action) => {
                action.loop = LoopOnce;
                action.clampWhenFinished = true;
                action.timeScale = -1;
                action.reset();
                action.play();
                action.time = action.getClip().duration;
            });
        }
    }, [toBeOpen, actions]);

    //When DVD finishes closing, push it back in if requested
    useEffect(() => {
        if(!isOpen && shouldPushBackAfterClosingRef.current && pulledOut.current){
            shouldPushBackAfterClosingRef.current = false;
            setToBeOpen(false);
            setRotateDVD(false);
            setPulledOutDVDId(null);
        }
    }, [isOpen]);


    //used for the fully pulled out/ pushed back in animations
    const pulledOut = useRef(false);
    //if the DVD was just pulled out, mark it as such.
    if (pulledOutDVDId === Dvd_Data.id){
        pulledOut.current = true; //keeps track of whether THIS dvd is pulled out or was just previously pulled out 
    }
    else if (pulledOut.current) { // NOTE: if this DVD was previously pulled out, it will remain marked as pulled out until pushed back in.
        pulledOut.current = false; 
        setAnimation([]);//clear current animations 
        addAnimations(getPushedInAnimations())
    }

    const rotationRef = useRef({angleX: 0, angleY: 0, deltaX: 0, deltaY: 0}); //keeps track of the current rotation state of the DVD
    const [rotateDVD, setRotateDVD] = useState(false); //keeps track of whether the DVD is currently ABLE to be rotated, i.e., user can click and drag to rotate

    //animations of the DVD being pulled back off the shelf and then brought to the center.
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
    //animations of the DVD being rotated + moved back to its spot on the shelf, and then being pushed in
    //Note: This has to be a function because it relies on the CURRENT rotation of the DVD
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

    //rotateds the dvd in place from its current rotation to the target rotation
    function getRotateToAnimation(targetRotX, targetRotY, targetRotZ) {
        return {
            type: 'move',
            desc: 'rotateTo',
            from: {x: DvdRef.current.position.x, y: DvdRef.current.position.y, z: DvdRef.current.position.z},
            fromRot: {rotX: DvdRef.current.rotation.x, rotY: DvdRef.current.rotation.y, rotZ: DvdRef.current.rotation.z},
            to: {x: DvdRef.current.position.x, y: DvdRef.current.position.y, z: DvdRef.current.position.z},
            toRot: {rotX: targetRotX, rotY: targetRotY, rotZ: targetRotZ},
            speed: 4
        };
    }



    /******animate the DVD, animation is picked based on list or current state/user interaction******/
    useFrame((state, delta) => {
        let anim = null;

        //if there are animations/set an animation
        if (pendingAnimations && pendingAnimations.length > 0) { 
           anim = pendingAnimations[0];
        }
        //used for user rotation of DVD - pauses all other animations when rotating
        else if(pulledOut.current && rotateDVD) {
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
        else if(pulledOut.current) {
            return;
        }
        else {
            const targetZ = Dvd_Data.posZ + (isHovered ? 1 : 0);
            const distance = targetZ - DvdRef.current.position.z;
            const step = (isHovered ? 3 : 1.5) * delta;
            DvdRef.current.position.z += Math.sign(distance) * Math.min(Math.abs(distance), step);
            return;
        }
        //Animation control: determine which animation to play
        let progress = 0;

        //used for simple linear and rotational animations
        if(anim && anim.type === 'move') {
            animationElapsedRef.current += delta * anim.speed;
            
            const distance = Math.sqrt(
                Math.pow(anim.to.x - anim.from.x, 2) +
                Math.pow(anim.to.y - anim.from.y, 2) +
                Math.pow(anim.to.z - anim.from.z, 2)
            );
        
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

            if(anim.desc === 'pulledOutFinish'){
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

    const scale = 2.8; //debug

    return(

        <group ref={DvdRef}  
                dispose={null} 
                scale={.37} 
                position={[Dvd_Data.posX, Dvd_Data.posY, Dvd_Data.posZ]} 

                onPointerOver={(event) => {
                                        event.stopPropagation();
                                        if(pulledOutDVDId == null){//do not "pop out" if there is a DVD already pulled out
                                            setIsHovered(true);
                                        }
                                    }}

                onPointerOut={(event) =>  { 
                                            event.stopPropagation();
                                            setIsHovered(false);
                                        }}

                onClick={(event) => {
                                    event.stopPropagation();
                                    //keep track of the last dvd to be clicked, this is used for showing dvd details and is seperate 
                                    // from pulled out since the dvd could be clicked to be pushed back in.
                                    onDVDClick(Dvd_Data.id);
                                    
                                    //prevent triggering for double clicks
                                    if (clickTimeoutRef.current) {
                                        clearTimeout(clickTimeoutRef.current);
                                        clickTimeoutRef.current = null;
                                        return;
                                    }
                                    
                                    //if a second click doesnt happen in 200ms, do click
                                    clickTimeoutRef.current = setTimeout(() => {
                                        clickTimeoutRef.current = null;
                                        if (pulledOut.current) {
                                            //if the DVD is open, close it first before pushing back in
                                            if(isOpen){
                                                shouldPushBackAfterClosingRef.current = true;
                                                setToBeOpen(false);
                                            } else {
                                                //if already closed, push back in immediately
                                                setPulledOutDVDId(null);
                                                setRotateDVD(false);
                                                addAnimations(getPushedInAnimations());
                                                pulledOut.current = false;
                                            }
                                        } else {
                                            setPulledOutDVDId(Dvd_Data.id);
                                            addAnimations(pulledOutAnimations);
                                        }
                                    }, 200);
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
                onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        if(pulledOut.current){
                                            if(isOpen){
                                                setToBeOpen(false);
                                            } else {
                                                setToBeOpen(true);
                                                //rotate the DVD so that the opening side faces the user
                                                addAnimation(getRotateToAnimation(0, Math.PI, 0));
                                            }


                                        }
                                    }}>

        <group name="Generic_DVD_Model_Scene">
            <group name="dvd_case" rotation={[0, -0.825, 0]} />
            <group name="dvd_case001" position={[0, 0, 0]} rotation={[.5*Math.PI, -0.826, 0]}>
            <group name="back_side001" position={[0, 0, 0]} rotation={[1.572, -0.001, -2.397]} />
            <mesh name="back_side" geometry={nodes.back_side.geometry} material={materials['Black DVD']} position={[-0.981, 0.234, 0.364]} rotation={[1.572, -0.001, -2.397]}>
                <mesh name="conector" geometry={nodes.conector.geometry} material={materials['Black DVD']} position={[-0.007, 0.092, -6.745]} rotation={[0.031, 0, 0.001]}>
                <mesh name="front_side" geometry={nodes.front_side.geometry} material={materials['Black DVD']} position={[0.007, 1.564, 0.004]} rotation={[-0.035, 0, 0]} />
                <mesh name="front_side001" geometry={nodes.front_side001.geometry}  position={[0.007, 1.564, 0.004]} rotation={[-0.035, 0, 0]}>
                    <Decal
                        position={[0, 0, 7]}
                        rotation={[-.5 * Math.PI, 0, -.5 * Math.PI]}
                        scale={[5.32 * scale , 7.48 * scale, 1]}>
                        
                        <meshBasicMaterial
                            map={Dvd_Data.outerFrontFaceText ?? null}
                            onUpdate={updateTextureMaterial}
                            transparent={true}
                            polygonOffset
                            polygonOffsetFactor={-1}/>
                        
                    </Decal>
                </mesh>
                </mesh>
                <mesh name="connector_outer_face" geometry={nodes.connector_outer_face.geometry}  position={[-0.007, 0.092, -6.745]} rotation={[0.031, 0, 0.001]}>
                    <Decal
                        position={[0, 1, 0]}
                        rotation={[.5 * Math.PI, 0, -.5 * Math.PI]}
                        scale={[.55 * scale , 7.48 * scale, 1]}
                        debug>
                        
                        <meshBasicMaterial
                            map={Dvd_Data.spineText ?? null}
                            onUpdate={updateTextureMaterial}
                            transparent={true}
                            polygonOffset
                            polygonOffsetFactor={-1}/>
                        
                    </Decal>
                </mesh>

            </mesh>
            <mesh name="back_side_outer_face" geometry={nodes.back_side_outer_face.geometry} position={[-0.981, 0.234, 0.364]} rotation={[1.572, -0.001, -2.397]} >
                <Decal
                    position={[0, 0, 0]}
                    rotation={[.5 * Math.PI, 0, -.5 * Math.PI]}
                    scale={[5.32 * scale , 7.48 * scale, 1]}>
                        
                    <meshBasicMaterial
                        map={Dvd_Data.outerBackFaceText ?? null}
                        onUpdate={updateTextureMaterial}
                        transparent={true}
                        polygonOffset
                        polygonOffsetFactor={-1}/>
                </Decal>
            </mesh>
            </group>
        </group>
        </group>
        )
}
useGLTF.preload(gltfDirect);
export default DVD_Model;

        {/*
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

*/}
            {/* DVD case measured in inches: width x height x depth 
            <boxGeometry args={[.55, 7.48, 5.31]}/>
            <meshStandardMaterial color={"white"}/>
        </mesh>*/}