class DVD_Data {
    constructor(title, actors, directors, desc, posX, posY, posZ, outerFrontFaceText, outerBackFaceText, spineText){
        this.title = title;
        this.actors = actors;
        this.directors = directors;
        this.desc = desc;
        this.posX = posX;
        this.posY = posY;
        this.posZ = posZ;
        //textures 
        this.outerFrontFaceText = outerFrontFaceText;
        this.outerBackFaceText = outerBackFaceText;
        this.spineText = spineText;
        this.animations = [];

    }

    //texture stuff
    //not written yet

}

export default DVD_Data;