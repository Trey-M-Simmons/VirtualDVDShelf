import { use, useEffect, useState } from 'react'
import VirtualShelf from './VirtualShelfRender.jsx'
import GenericDVD from './GenericDVD.jsx'
import { Canvas } from '@react-three/fiber'// debug
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import {TextureLoader} from 'three';
//import './App.css'

/*early testing, no db loading*/
let testDVDs = [];

for (let i = 0; i < 60; i++) {
  testDVDs.push({
    id: testDVDs.length + 1,
    title: `Test DVD ${testDVDs.length + 1}`,
    actors: ["Actor 1", "Actor 2"],
    directors: ["Director 1"],
    desc: "Description of the test DVD",
    posX: 0,
    posY: 0,
    posZ: 0,
    outerFrontFaceText: null,
    outerBackFaceText: null,
    spineText: null,
    animations: []
  });
}
//note: animation looks like { type: 'move', from: {x:0, y:0, z:0}, to: {x:1, y:1, z:1}, speed: 1}
/*early testing, no db loading^^^^^^^*/

//sets initial positions for DVDs on the shelfs
function resetDVDs(DvdList) {
  let newDvdList = [...DvdList];
  let X = -shelfData.width/2 + shelfData.thin + 0.25;
  //initial Y offset to place the DVDs on the actual shelf
  let Y = -.25;
  let Z = 0;

  for (let i = 0; i < newDvdList.length; i++) {
    newDvdList[i].posX = X;
    newDvdList[i].posY = Y;
    newDvdList[i].posZ = Z;
    X += (shelfData.thin + 0.25); //note, thin side of shelf + the spacing between DVDs

    //move to the next shelf if we have filled it up
    if (X > shelfData.width/2 - shelfData.thin) {
      X = -shelfData.width/2 + shelfData.thin + 0.25;
      Y -= shelfData.height;
    }
  }

  return newDvdList;
}


const shelfData = {numOfShelves: 3, depth: 6, height: 8.25, width: 24.50, thin: 0.5 };

function App() {
  //TEMP used for DEBUG
    let tempFrontTexture = useLoader(THREE.TextureLoader, "/front.png");
    let tempBackTexture = useLoader(THREE.TextureLoader, "/back.png");
    let tempSpineTexture = useLoader(THREE.TextureLoader, "/spine.png");

  /********** State for DVDs and shelf data ***********/
  testDVDs = resetDVDs(testDVDs);
  const [dvds, setDvds] = useState(resetDVDs(testDVDs));//also set initial positions for DVDs

  const [shelf, setShelf] = useState(shelfData);
  const [pulledOutDVDId, setPulledOutDVDId] = useState(null);

  /* begin loading DVD textures */

  useEffect(() => {
    for (let i = 0; i < dvds.length; i++) {
      async function loadTextures(dvdToLoad) {
        //get textures from the api 
        let frontTexture = null;
        let backTexture = null;
        let spineTexture = null;

        //then assign them to the DVD object
        //const textureLoader = new THREE.TextureLoader();
        frontTexture = tempFrontTexture;
        backTexture = tempBackTexture;
        spineTexture = tempSpineTexture;
        /*
        textureLoader.load(URL.createObjectURL("/front.png"), (texture) => {
          frontTexture = texture;
        });
        textureLoader.load(URL.createObjectURL("/back.png"), (texture) => {
          backTexture = texture;
        });
        textureLoader.load(URL.createObjectURL("/spine.png"), (texture) => {
          spineTexture = texture;
        });*/
        
        //update textures for the DVD in the state
        setDvds(oldDVDs => oldDVDs.map((dvd) => {
          if (dvd.id === dvdToLoad.id) {
            dvd.outerFrontFaceText = frontTexture;
            dvd.outerBackFaceText = backTexture;
            dvd.spineText = spineTexture;
            return ({
              ...dvd,
              outerFrontFaceText: frontTexture,
              outerBackFaceText: backTexture,
              spineText: spineTexture
            });
          }
          return dvd;
        }));

      }

      //only load textures if they haven't been loaded yet
      if (!dvds[i].outerFrontFaceText || !dvds[i].outerBackFaceText || !dvds[i].spineText){
        loadTextures(dvds[i]);
      }
    }

  }, [dvds]);




  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <VirtualShelf dvds={dvds} setDvds={setDvds} shelfData={shelf} pulledOutDVDId={pulledOutDVDId} setPulledOutDVDId={setPulledOutDVDId}/>
    </div>
  )
}

export default App
