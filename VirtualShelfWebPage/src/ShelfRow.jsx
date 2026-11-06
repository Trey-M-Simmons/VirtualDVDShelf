function ShelfRow({posX, posY, posZ, width, length, thin}){

    const color = "burlywood";
    // const thin =.5;
    // const width = 6;
    // const length = 8;

    //update the position of each DVD based on the row's position
    return(
        <group position={[posX, posY, posZ]}>
            {/* Shelf base */}
            <mesh position={[0, -length/2, 0]}>
                <boxGeometry args={[2*length, thin, width]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* left shelf wall */}
            <mesh position={[-length, 0, 0]}>
                <boxGeometry args={[thin, length, width]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* right shelf wall */}
            <mesh position={[length, 0, 0]}>
                <boxGeometry args={[thin, length, width]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
            {/* back shelf wall */}
            <mesh position={[0, 0, -width/2]}>
                <boxGeometry args={[2*length, length, thin]}/>
                <meshStandardMaterial color={color}/>
            </mesh>
        </group>
    )
}

export default ShelfRow;