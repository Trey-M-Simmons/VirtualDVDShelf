import { useState } from 'react'
import DVD_Model from './DVD_Model.jsx'
import DVD_Data from './DVD_Data.js'
import VirtualShelf from './VirtualShelfRender.jsx'
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
    animations: []
  });
}
//note: animation looks like { type: 'move', from: {x:0, y:0, z:0}, to: {x:1, y:1, z:1}, speed: 1}
/*early testing, no db loading^^^^^^^*/

//sets initial positions for DVDs on the shelfs
function resetDVDs(DvdList) {
  let newDvdList = [...DvdList];
  let X = -shelfData.length + shelfData.thin;
  let Y = 0;
  let Z = 0;

  for (let i = 0; i < newDvdList.length; i++) {
    newDvdList[i].posX = X;
    newDvdList[i].posY = Y;
    newDvdList[i].posZ = Z;
    X += shelfData.thin + .1; 

    //move to the next shelf if we have filled it up
    if (X > shelfData.length) {
      X = -shelfData.length + shelfData.thin;
      Y -= shelfData.thin + shelfData.length;
    }
  }

  return newDvdList;
}

const shelfData = {numOfShelves: 3, width: 6, length: 8, thin: 0.5 };

function App() {

  /********** State for DVDs and shelf data ***********/
  const [dvds, setDvds] = useState(resetDVDs(testDVDs));//also set initial positions for DVDs

  const [shelf, setShelf] = useState(shelfData);


  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <VirtualShelf dvds={dvds} shelfData={shelf}/>
    </div>
  )
}

export default App
