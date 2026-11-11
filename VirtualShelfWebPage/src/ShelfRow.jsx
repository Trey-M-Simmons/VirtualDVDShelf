function ShelfRow({posX, posY, posZ, depth, height, width, thin }){

    const color = "burlywood";
    // const thin =.5;
    // const width = 6;
    // const length = 8;

    //update the position of each DVD based on the row's position
    return(
        <group position={[posX, posY, posZ]}>
            {/* Shelf base */}
            <mesh position={[0, -height/2, 0]}>
                <boxGeometry args={[width, thin, depth]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* left shelf wall */}
            <mesh position={[-width/2, 0, 0]}>
                <boxGeometry args={[thin, height, depth]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* right shelf wall */}
            <mesh position={[width/2, 0, 0]}>
                <boxGeometry args={[thin, height, depth]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* back shelf wall */}
            <mesh position={[0, 0, -depth/2]}>
                <boxGeometry args={[width, height, thin]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
        </group>
    )
}

export default ShelfRow;