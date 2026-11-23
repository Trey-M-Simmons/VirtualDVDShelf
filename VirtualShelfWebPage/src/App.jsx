import { use, useEffect, useState, useRef } from 'react'
import VirtualShelf from './VirtualShelfRender.jsx'
import AddDVDMenu from './AddDVDMenu.jsx'
import DVDInfoMenu from './DVDInfoMenu.jsx'
import AccountMenu from './AccountMenu.jsx'
import { Canvas } from '@react-three/fiber'// debug
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import {TextureLoader} from 'three';
//import './App.css'

const baseURL = "http://127.0.0.1:8000";

//const shelfData = {numOfShelves: 3, depth: 6, height: 8.25, width: 24.50, thin: 0.5 };
//converts API response to DVD object used in the frontend
function dvdFromResponse(dvd) {
  return {
    id: dvd.dvd_id,
    title: dvd.title,
    actors: dvd.actors,
    directors: dvd.directors,
    desc: dvd.description,
    posX: 0,
    posY: 0,
    posZ: 0,
    textureSetId: dvd.texture_set_ids[0],
    outerFrontFaceText: null,
    outerBackFaceText: null,
    spineText: null,
    animations: [],
  };
}

function App() {

  /*************** Initialize DVDs and get textures ***********/
  //get dvd data from API and create initial DVD objects
  async function getInitialDVDs(userName, signal) {
    //fetch DVDs for the given user from the backend API
    const response = await fetch(baseURL + `/api/dvds/user/${encodeURIComponent(userName)}`, { signal });
    //check if api call failed, if so throw an error to be caught by the caller
    if (!response.ok) {
      throw new Error(`Failed to load DVDs: ${response.status}`);
    }
    const data = await response.json();
    //if the request was aborted, stop processing
    if (signal.aborted) return;
    setShelfError('');

    setDvds(oldDVDs => resetDVDs(data.map((item) => {
      const dvd = dvdFromResponse(item);
      const previous = oldDVDs.find((oldDVD) => oldDVD.id === dvd.id);
      //if the texture set id hasn't changed, reuse the previous textures and animations.
      //if the dvd didnt exist before then previous?.textureSetId will be undefined, so we won't reuse any textures.
      if (previous?.textureSetId === dvd.textureSetId) {
        return {
          ...dvd,
          outerFrontFaceText: previous.outerFrontFaceText,
          outerBackFaceText: previous.outerBackFaceText,
          spineText: previous.spineText,
          animations: previous.animations,
        };
      }
      return dvd;
    })));
  }

  //sets initial positions for DVDs on the shelfs/number of shelves
  function resetDVDs(DvdList) {
    let newDvdList = [...DvdList];
    let X = -shelf.width/2 + shelf.thin + 0.25;
    //initial Y offset to place the DVDs on the actual shelf
    let Y = -.25;
    let Z = 0;

    for (let i = 0; i < newDvdList.length; i++) {
      newDvdList[i].posX = X;
      newDvdList[i].posY = Y;
      newDvdList[i].posZ = Z;
      X += (shelf.thin + 0.25); //note, thin side of shelf + the spacing between DVDs

      //move to the next shelf if we have filled it up
      if (X > shelf.width/2 - shelf.thin) {
        X = -shelf.width/2 + shelf.thin + 0.25;
        Y -= shelf.height;
      }
    }
    //adjust the number of shelves based on the number of DVDs
    const numOfShelves = Math.max(Math.ceil(Math.abs(Y) / shelf.height), 5);
    setShelf(prevShelf => ({ ...prevShelf, numOfShelves }));
    return newDvdList;
    //numOfShelves can be used to adjust the shelf display if needed
  }

  /*******************************************************/

  //is used for getting the correct user's DVDs from the API
  //generation is used to keep track of how many times the account has changed, to prevent handling stale responses(add/remove dvds) from previous accounts. 
  const [account, setAccount] = useState({ username: "testuser", generation: 0 });
  const userName = account.username;
  const currentAccount = useRef(account);
  //used to display operations that have finished on an previous account
  const [operationNotice, setOperationNotice] = useState('');
  //NOTE: account and currentAccount are used together to track the current user and prevent handling stale responses from previous accounts

  /********** State for DVDs and shelf data ***********/
  //testDVDs = resetDVDs(testDVDs);
  const [dvds, setDvds] = useState([]);//also set initial positions for DVDs
  const [shelfRefresh, setShelfRefresh] = useState(0);//does shelf need refresh, 
  const [shelfError, setShelfError] = useState('');
  const shelfRequest = useRef(null);//used to abort ongoing dvd data fetches


  //if a user adds a DVD to their shelf
  function handleDVDAdded(dvd, requestedUser, generation) {
    //do not re-load dvds in the canvas if the account has changed
    if (currentAccount.current.generation !== generation) {
      setOperationNotice(`"${dvd.title}" was added to ${requestedUser}'s shelf after switching accounts.`);
      return;
    }
    shelfRequest.current?.abort();
    setDvds(oldDVDs => resetDVDs([...oldDVDs.map(item => ({ ...item })), dvdFromResponse(dvd)]));
    setShelfRefresh(value => value + 1);
  }

  //if a user removes a DVD from their shelf
  function handleDVDRemoved(dvdId, requestedUser, generation) {
    //do not re-load dvds in the canvas if the account has changed
    if (currentAccount.current.generation !== generation) {
      setOperationNotice(`A DVD was removed from ${requestedUser}'s shelf after switching accounts.`);
      return;
    }
    shelfRequest.current?.abort();
    setDvds(oldDVDs => resetDVDs(oldDVDs.filter(dvd => dvd.id !== dvdId).map(dvd => ({ ...dvd }))));
    setLastClickedDVDId(current => current === dvdId ? null : current);
    setPulledOutDVDId(current => current === dvdId ? null : current);
    setShelfRefresh(value => value + 1);
  }

  //handles errors for operations that were initiated on a previous account
  function handlePreviousAccountError(error, requestedUser, generation) {
    if (currentAccount.current.generation !== generation) {
      setOperationNotice(`An operation for ${requestedUser}'s shelf failed: ${error}`);
    }
  }

  //tracks what dvd textures are currently loading, used to avoid duplicate requests
  //holds sets of dvd ids and dvd texture ids
  const dvdsTextureLoading= useRef(new Set());
  
  //used to trigger fetching initial DVDs/when the username changes
  useEffect(() => {
    //stop old request from updating dvd textures by using an AbortController
    //had an issue where changing the username would cause old requests to update the state/textures
    const controller = new AbortController();
    shelfRequest.current = controller;
    getInitialDVDs(userName, controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        console.error('Failed to load DVDs:', error);
        setShelfError('Could not load the shelf. Please retry.');
      }
    });
    return () => controller.abort();
  }, [userName, shelfRefresh]);

  //keeps track of the size, shape, and number of the shelfs
  const [shelf, setShelf] = useState({numOfShelves: 3, depth: 6, height: 8.25, width: 24.50, thin: 0.5 });
  const [pulledOutDVDId, setPulledOutDVDId] = useState(null); //what DVD is currently pulled out
  const [lastClickedDVDId, setLastClickedDVDId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  //handles selecting a different account
  function selectAccount(username) {
    //ignore non changed account
    if (currentAccount.current.username === username) return;
    //increment generation(number of times the account has been switched)
    const nextAccount = { username, generation: currentAccount.current.generation + 1 };
    currentAccount.current = nextAccount;
    //abort dvd data resquests for the previous account, this is so that they do not overwrite the state of the new account
    shelfRequest.current?.abort();
    //reset the shelf and related state for the new account
    setDvds([]);
    setLastClickedDVDId(null);
    setPulledOutDVDId(null);
    setShelfError('');
    setAccount(nextAccount);
  }

  /*************** Begin loading DVD textures *********/
  useEffect(() => {
    for (let i = 0; i < dvds.length; i++) {
      const currDvd = dvds[i];

      async function loadTextures(dvdToLoad) {
        //load a specific texture
        async function loadTexture(textureSetId, face) {
          //fetch the texture from the API
          const response = await fetch(
            `${baseURL}/api/textures/${textureSetId}/${face}`
          );

          //check if the response is ok
          if (!response.ok) {
            throw new Error(`Failed to load ${face}: ${response.status}`);
          }

          //convert the response to a blob and create an object URL
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          //create an image element and load the object URL into it
          return new Promise((resolve, reject) => {
            const img = new Image();

            //on successful image load, create a THREE.Texture from the image
            img.onload = () => {
              URL.revokeObjectURL(url);
              const texture = new THREE.Texture(img);
              texture.needsUpdate = true;
              resolve(texture);
            };
            //on failure reject the promise
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error(`Failed to decode ${face} image`));
            };
            //start loading the image, is needed to trigger the onload or onerror events
            img.src = url;
            });

        }
        //get textures from the api 
        const [frontTexture, backTexture, spineTexture] = await Promise.all([
          loadTexture(dvdToLoad.textureSetId, "front_face"),
          loadTexture(dvdToLoad.textureSetId, "back_face"),
          loadTexture(dvdToLoad.textureSetId, "spine")
        ]);

        //update textures for the DVD in the state
        setDvds(oldDVDs => oldDVDs.map((dvd) => {
          if (dvd.id === dvdToLoad.id && dvd.textureSetId === dvdToLoad.textureSetId) {
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
      if (!currDvd.outerFrontFaceText && !currDvd.outerBackFaceText && !currDvd.spineText){
        //check if dvd has begun loading textures
        const loadingKey = `${currDvd.id}/${currDvd.textureSetId}`;
        if (!dvdsTextureLoading.current.has(loadingKey)) {
          dvdsTextureLoading.current.add(loadingKey);
          //load textures, remove key on error (allow retry)
          loadTextures(currDvd)
            .catch((error) => {
              console.error(`Failed to load textures for DVD ${currDvd.id}:`, error);
            })
            .finally(() => {
              dvdsTextureLoading.current.delete(loadingKey);
            });
        }
      }
    }

  }, [dvds]);




  return (
    <div className="shelf-app">
      <AccountMenu baseURL={baseURL} userName={userName} onSelect={selectAccount} open={openMenu === 'account'} setOpen={open => setOpenMenu(open ? 'account' : null)} />
      <AddDVDMenu key={userName} baseURL={baseURL} userName={userName} onAdded={dvd => handleDVDAdded(dvd, userName, account.generation)} onRemoved={id => handleDVDRemoved(id, userName, account.generation)} onOperationError={error => handlePreviousAccountError(error, userName, account.generation)} selectedDVD={dvds.find(dvd => dvd.id === lastClickedDVDId)} open={openMenu === 'add'} setOpen={open => setOpenMenu(open ? 'add' : null)} />
      <DVDInfoMenu dvd={dvds.find(dvd => dvd.id === lastClickedDVDId)} open={openMenu === 'info'} setOpen={open => setOpenMenu(open ? 'info' : null)} />
           {operationNotice && <div role="status">{operationNotice} <button type="button" onClick={() => setOperationNotice('')}>Dismiss</button></div>}
      {/* If there was an issue loading the shelf/DVDS, show an alert to allow retry */}
      {shelfError && (
        <div role="alert">
          {shelfError} <button type="button" onClick={() => setShelfRefresh(value => value + 1)}>Retry</button>
        </div>
      )}
      <VirtualShelf dvds={dvds} setDvds={setDvds} shelfData={shelf} pulledOutDVDId={pulledOutDVDId} setPulledOutDVDId={setPulledOutDVDId} onDVDClick={setLastClickedDVDId}/>
    </div>
  )
}

export default App
